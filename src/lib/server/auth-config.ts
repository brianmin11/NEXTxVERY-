import type { BetterAuthOptions } from "better-auth"
import { APIError, createAuthMiddleware } from "better-auth/api"

export type AuthMailMessage = {
  kind: "verify-email" | "reset-password"
  to: string
  url: string
  token: string
}

export type AuthMailReceipt = {
  status: "provider-accepted"
  provider: "resend"
  id: string
}

/** Inject a provider only after its domain, sender and release scope are approved. */
export type AuthMailAdapter = {
  /** Simulated adapters never represent successful delivery to a mailbox. */
  delivery: "live" | "test-live" | "simulated"
  send(message: AuthMailMessage): Promise<void | AuthMailReceipt>
}

type AuthEnvironment = Record<string, string | undefined>

function origin(value: string, name: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name} must be an absolute HTTP(S) origin`)
  }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  if (
    !["https:", "http:"].includes(url.protocol) ||
    (url.protocol !== "https:" && !loopback) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !/^[a-z]+:\/\/[^/?#@*\\]+\/?$/i.test(value)
  ) {
    throw new Error(
      `${name} must be an exact HTTPS origin (HTTP is allowed only on loopback)`
    )
  }
  return url.origin
}

function positiveSeconds(
  env: AuthEnvironment,
  name: string,
  fallback: number,
  maximum = 2592000
) {
  const value = env[name]
  if (value === undefined) return fallback
  if (
    !/^[1-9]\d*$/.test(value) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) > maximum
  ) {
    throw new Error(`${name} must be an integer from 1 to ${maximum} seconds`)
  }
  return Number(value)
}

function enabled(env: AuthEnvironment, name: string) {
  const value = env[name]
  if (value !== undefined && value !== "true" && value !== "false") {
    throw new Error(`${name} must be true or false`)
  }
  return value === "true"
}

/** Pure configuration factory: no network, environment mutation or implicit mail sender. */
export function createAuthOptions({
  database,
  env = process.env,
  mailer,
}: {
  database: BetterAuthOptions["database"]
  env?: AuthEnvironment
  mailer?: AuthMailAdapter
}): BetterAuthOptions {
  const secret = env.BETTER_AUTH_SECRET
  if (!secret || secret.trim().length < 32) {
    throw new Error(
      "BETTER_AUTH_SECRET must be configured with at least 32 characters"
    )
  }
  if (env.NODE_ENV === "production" && !env.BETTER_AUTH_URL) {
    throw new Error(
      "BETTER_AUTH_URL must be explicitly configured in production"
    )
  }
  const baseURL = origin(
    env.BETTER_AUTH_URL ?? "http://localhost:3100",
    "BETTER_AUTH_URL"
  )
  const trustedOrigins = [
    ...new Set([
      baseURL,
      ...(env.AUTH_TRUSTED_ORIGINS === undefined
        ? []
        : env.AUTH_TRUSTED_ORIGINS.split(",").map((value) =>
            origin(value.trim(), "AUTH_TRUSTED_ORIGINS")
          )),
    ]),
  ]
  const expiresIn = positiveSeconds(env, "AUTH_SESSION_EXPIRES_IN", 86400)
  const updateAge = positiveSeconds(env, "AUTH_SESSION_UPDATE_AGE", 3600)
  if (updateAge >= expiresIn)
    throw new Error(
      "AUTH_SESSION_UPDATE_AGE must be less than AUTH_SESSION_EXPIRES_IN"
    )
  const verifyEmail = enabled(env, "AUTH_EMAIL_VERIFICATION_ENABLED")
  const resetPassword = enabled(env, "AUTH_PASSWORD_RESET_ENABLED")
  const requireVerification = enabled(env, "AUTH_EMAIL_VERIFICATION_REQUIRED")
  const deliveryReady = enabled(env, "AUTH_EMAIL_DELIVERY_READY")
  if (mailer && !["live", "test-live", "simulated"].includes(mailer.delivery)) {
    throw new Error("Auth mail adapter must declare its delivery capability")
  }
  if (env.NODE_ENV === "production" && mailer?.delivery === "simulated") {
    throw new Error("Simulated auth mail adapters are forbidden in production")
  }
  if (
    requireVerification &&
    (!verifyEmail || !deliveryReady || mailer?.delivery !== "live")
  ) {
    throw new Error(
      "Required email verification needs enabled verification, confirmed delivery readiness and a live mail adapter"
    )
  }
  if ((verifyEmail || resetPassword) && !mailer) {
    throw new Error(
      "Enabled auth email features require an explicitly configured mail adapter"
    )
  }
  const send = async (message: AuthMailMessage) => {
    try {
      await mailer!.send(message)
    } catch {
      // Provider errors may contain credentials or the full token URL. Never propagate them.
      throw new Error("Authentication email delivery failed")
    }
  }
  return {
    database,
    secret,
    baseURL,
    trustedOrigins,
    disabledPaths: [
      ...(!verifyEmail ? ["/send-verification-email", "/verify-email"] : []),
      ...(!resetPassword
        ? [
            "/request-password-reset",
            "/reset-password",
            "/reset-password/:token",
          ]
        : []),
    ],
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        // disabledPaths matches literal URLs only; also guard dynamic reset URLs
        // and direct server API calls while the feature is switched off.
        if (
          (!resetPassword &&
            (ctx.path === "/request-password-reset" ||
              ctx.path.startsWith("/reset-password"))) ||
          (!verifyEmail &&
            ["/send-verification-email", "/verify-email"].includes(ctx.path))
        )
          throw new APIError("NOT_FOUND", {
            message: "Authentication feature is disabled",
          })
      }),
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      requireEmailVerification: requireVerification,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: positiveSeconds(
        env,
        "AUTH_RESET_PASSWORD_EXPIRES_IN",
        900,
        3600
      ),
      // Better Auth intentionally returns the same conditional 200 response for
      // existing/unknown accounts and swallowed delivery failures. It acknowledges
      // the request, NOT mailbox delivery. UI must say "request received"; only
      // provider evidence can confirm delivery. Keep account existence private.
      ...(resetPassword
        ? {
            sendResetPassword: async ({ user, url, token }) =>
              send({ kind: "reset-password", to: user.email, url, token }),
          }
        : {}),
    },
    ...(verifyEmail
      ? {
          emailVerification: {
            // Optional verification must not turn mail outages into login failures.
            // Users request verification explicitly until delivery is confirmed.
            sendOnSignUp: requireVerification,
            sendOnSignIn: requireVerification,
            autoSignInAfterVerification: false,
            expiresIn: positiveSeconds(
              env,
              "AUTH_EMAIL_VERIFICATION_EXPIRES_IN",
              3600,
              86400
            ),
            sendVerificationEmail: async ({ user, url, token }) =>
              send({ kind: "verify-email", to: user.email, url, token }),
          } satisfies BetterAuthOptions["emailVerification"],
        }
      : {}),
    session: { expiresIn, updateAge, cookieCache: { enabled: false } },
    rateLimit: { enabled: true, window: 60, max: 50 },
    advanced: {
      cookiePrefix: "woorijip",
      useSecureCookies: baseURL.startsWith("https:"),
      crossSubDomainCookies: { enabled: false },
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", path: "/" },
      trustedProxyHeaders: false,
    },
  }
}
