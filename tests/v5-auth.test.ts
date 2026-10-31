import test from "node:test"
import assert from "node:assert/strict"
import { DatabaseSync } from "node:sqlite"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { betterAuth, type BetterAuthOptions } from "better-auth"
import { getMigrations } from "better-auth/db/migration"

type Mail = {
  kind: "verify-email" | "reset-password"
  to: string
  url: string
  token: string
}
type OptionsFactory = (input: {
  database: DatabaseSync
  env: Record<string, string | undefined>
  mailer?: { send(message: Mail): Promise<void> }
}) => BetterAuthOptions
const sourceRoot = process.env.V5_AUTH_SOURCE_ROOT || process.cwd()
const { createAuthOptions } = (await import(
  pathToFileURL(resolve(sourceRoot, "src/lib/server/auth-config.ts")).href
)) as { createAuthOptions: OptionsFactory }
const origin = "https://family.example.test"
const password = "Synthetic-password-123!"
const env = (
  extra: Record<string, string | undefined> = {}
): Record<string, string | undefined> => ({
  NODE_ENV: "production",
  BETTER_AUTH_SECRET: "synthetic-test-secret-only-32-characters-long",
  BETTER_AUTH_URL: origin,
  ...extra,
})
let fixtureNumber = 0
async function fixture(
  extra: Record<string, string | undefined> = {},
  withMailer = false
) {
  const ip = `192.0.2.${++fixtureNumber}`
  const db = new DatabaseSync(":memory:")
  const mail: Mail[] = []
  const options = createAuthOptions({
    database: db,
    env: env(extra),
    ...(withMailer
      ? {
          mailer: {
            async send(message: Mail) {
              mail.push(message)
            },
          },
        }
      : {}),
  })
  await (await getMigrations(options)).runMigrations()
  const auth = betterAuth(options)
  async function request(
    path: string,
    body?: object,
    cookie?: string,
    requestOrigin = origin
  ) {
    return auth.handler(
      new Request(`${origin}/api/auth${path}`, {
        method: body ? "POST" : "GET",
        headers: {
          origin: requestOrigin,
          "x-forwarded-for": ip,
          ...(body ? { "content-type": "application/json" } : {}),
          ...(cookie ? { cookie } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
    )
  }
  async function signup(email = "person@example.test") {
    const result = await request("/sign-up/email", {
      email,
      password,
      name: "Synthetic Person",
    })
    assert.equal(result.status, 200, await result.clone().text())
    return result
  }
  function cookie(response: Response) {
    return response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ")
  }
  return { db, mail, request, signup, cookie }
}

test("production configuration rejects unsafe origins and invalid session limits", () => {
  const db = new DatabaseSync(":memory:")
  try {
    for (const invalid of [
      "http://family.example.test",
      "https://family.example.test/path",
      "https://user:password@family.example.test",
      "https://*.example.test",
      "https://family.example.test?x=1",
    ]) {
      assert.throws(
        () =>
          createAuthOptions({
            database: db,
            env: env({ BETTER_AUTH_URL: invalid }),
          }),
        invalid
      )
    }
    assert.throws(() =>
      createAuthOptions({
        database: db,
        env: env({ BETTER_AUTH_URL: undefined }),
      })
    )
    for (const invalid of [
      "*",
      "https://*.example.test",
      "https://evil.test/path",
    ]) {
      assert.throws(
        () =>
          createAuthOptions({
            database: db,
            env: env({ AUTH_TRUSTED_ORIGINS: invalid }),
          }),
        invalid
      )
    }
    for (const invalid of ["0", "-1", "1.5", "Infinity", "abc"]) {
      assert.throws(() =>
        createAuthOptions({
          database: db,
          env: env({ AUTH_SESSION_EXPIRES_IN: invalid }),
        })
      )
    }
    assert.throws(() =>
      createAuthOptions({
        database: db,
        env: env({
          AUTH_SESSION_EXPIRES_IN: "10",
          AUTH_SESSION_UPDATE_AGE: "10",
        }),
      })
    )
    assert.doesNotThrow(() =>
      createAuthOptions({
        database: db,
        env: env({ BETTER_AUTH_URL: "http://localhost:3219" }),
      })
    )
    for (const flag of [
      "AUTH_EMAIL_VERIFICATION_ENABLED",
      "AUTH_PASSWORD_RESET_ENABLED",
    ]) {
      assert.throws(
        () => createAuthOptions({ database: db, env: env({ [flag]: "true" }) }),
        "feature must not activate without mail adapter"
      )
    }
  } finally {
    db.close()
  }
})

test("signup, secure host cookie, origin rejection, logout, relogin and server-side expiry", async () => {
  const f = await fixture({ AUTH_TRUSTED_ORIGINS: "https://app.example.test" })
  try {
    const signup = await f.signup()
    const user = (await signup.json()).user
    const sessionCookie = f.cookie(signup)
    const setCookie = signup.headers
      .getSetCookie()
      .find((value) => value.includes("session_token"))!
    assert.ok(setCookie)
    assert.match(setCookie, /; Secure/i)
    assert.match(setCookie, /; HttpOnly/i)
    assert.match(setCookie, /; SameSite=Lax/i)
    assert.doesNotMatch(setCookie, /; Domain=/i)
    const session = await (
      await f.request("/get-session", undefined, sessionCookie)
    ).json()
    assert.equal(session.user.id, user.id)
    assert.equal(session.user.email, "person@example.test")
    assert.equal(
      (await f.request("/sign-out", {}, sessionCookie, "https://attacker.test"))
        .status,
      403
    )
    assert.ok(
      await (await f.request("/get-session", undefined, sessionCookie)).json()
    )
    const logout = await f.request("/sign-out", {}, sessionCookie)
    assert.equal(logout.status, 200)
    assert.equal(
      await (await f.request("/get-session", undefined, sessionCookie)).json(),
      null
    )
    const login = await f.request(
      "/sign-in/email",
      { email: user.email, password },
      undefined,
      "https://app.example.test"
    )
    assert.equal(login.status, 200)
    assert.equal(
      (await login.clone().json()).user.id,
      user.id,
      "relogin preserves user/family identity"
    )
    const newCookie = f.cookie(login)
    assert.notEqual(newCookie, sessionCookie)
    f.db.prepare('UPDATE session SET "expiresAt" = ?').run(Date.now() - 60_000)
    assert.equal(
      await (await f.request("/get-session", undefined, newCookie)).json(),
      null
    )
    assert.equal(
      (
        await f.request("/sign-in/email", {
          email: user.email,
          password: "wrong-password-123",
        })
      ).status,
      401
    )
  } finally {
    f.db.close()
  }
})

test("mail features stay inactive by default", async () => {
  const f = await fixture({}, true)
  try {
    await f.signup()
    assert.equal(f.mail.length, 0)
    const response = await f.request("/request-password-reset", {
      email: "person@example.test",
      redirectTo: `${origin}/reset-password`,
    })
    assert.equal(response.status, 404)
    assert.equal(
      (await f.request("/reset-password/unused-token?callbackURL=%2F")).status,
      404
    )
    assert.equal(
      (
        await f.request("/reset-password", {
          token: "unused-token",
          newPassword: password,
        })
      ).status,
      404
    )
    assert.equal(
      (await f.request("/verify-email?token=unused-token")).status,
      404
    )
    assert.equal(
      (
        await f.request("/send-verification-email", {
          email: "person@example.test",
        })
      ).status,
      404
    )
    assert.equal(f.mail.length, 0)
    assert.equal(
      f.db.prepare("SELECT count(*) AS n FROM verification").get()?.n,
      0
    )
  } finally {
    f.db.close()
  }
})

test("password recovery preserves identity, revokes sessions, consumes token once and rejects expiration", async () => {
  const f = await fixture({ AUTH_PASSWORD_RESET_ENABLED: "true" }, true)
  try {
    const signup = await f.signup()
    const oldCookie = f.cookie(signup)
    const id = (await signup.json()).user.id
    assert.equal(
      (
        await f.request("/request-password-reset", {
          email: "person@example.test",
          redirectTo: `${origin}/reset-password`,
        })
      ).status,
      200
    )
    assert.equal(f.mail.length, 1)
    const message = f.mail[0]
    assert.equal(message.kind, "reset-password")
    assert.equal(message.to, "person@example.test")
    assert.equal(new URL(message.url).origin, origin)
    const newPassword = "Changed-synthetic-password-456!"
    assert.equal(
      (
        await f.request("/reset-password", {
          token: message.token,
          newPassword,
        })
      ).status,
      200
    )
    assert.equal(
      await (await f.request("/get-session", undefined, oldCookie)).json(),
      null
    )
    assert.ok(
      (
        await f.request("/reset-password", {
          token: message.token,
          newPassword: password,
        })
      ).status >= 400
    )
    assert.equal(
      (await f.request("/sign-in/email", { email: message.to, password }))
        .status,
      401
    )
    const login = await f.request("/sign-in/email", {
      email: message.to,
      password: newPassword,
    })
    assert.equal(login.status, 200)
    assert.equal((await login.json()).user.id, id)
    await f.request("/request-password-reset", {
      email: message.to,
      redirectTo: `${origin}/reset-password`,
    })
    const expired = f.mail.at(-1)!
    f.db
      .prepare('UPDATE verification SET "expiresAt" = ?')
      .run(Date.now() - 60_000)
    assert.ok(
      (
        await f.request("/reset-password", {
          token: expired.token,
          newPassword: password,
        })
      ).status >= 400
    )
    const unknown = await f.request("/request-password-reset", {
      email: "missing@example.test",
      redirectTo: `${origin}/reset-password`,
    })
    assert.equal(unknown.status, 200)
    assert.equal(
      f.mail.length,
      2,
      "unknown account must not receive reset mail"
    )
  } finally {
    f.db.close()
  }
})

test("email verification gates login, accepts valid token and rejects tampering", async () => {
  const f = await fixture({ AUTH_EMAIL_VERIFICATION_ENABLED: "true" }, true)
  try {
    const signup = await f.signup()
    const id = (await signup.json()).user.id
    assert.equal(f.mail.length, 1)
    const message = f.mail[0]
    assert.equal(message.kind, "verify-email")
    assert.equal(
      (await f.request("/sign-in/email", { email: message.to, password }))
        .status,
      403
    )
    assert.ok(
      (
        await f.request(
          `/verify-email?token=${encodeURIComponent(message.token + "tampered")}`
        )
      ).status >= 400
    )
    assert.equal(
      (
        await f.request(
          `/verify-email?token=${encodeURIComponent(message.token)}`
        )
      ).status,
      200
    )
    const login = await f.request("/sign-in/email", {
      email: message.to,
      password,
    })
    assert.equal(login.status, 200)
    assert.equal((await login.json()).user.id, id)
  } finally {
    f.db.close()
  }
})

test("expired email verification token cannot verify an account", async () => {
  const f = await fixture(
    {
      AUTH_EMAIL_VERIFICATION_ENABLED: "true",
      AUTH_EMAIL_VERIFICATION_EXPIRES_IN: "1",
    },
    true
  )
  try {
    await f.signup()
    await new Promise((resolve) => setTimeout(resolve, 2100))
    assert.ok(
      (
        await f.request(
          `/verify-email?token=${encodeURIComponent(f.mail[0].token)}`
        )
      ).status >= 400
    )
    assert.equal(
      f.db.prepare('SELECT "emailVerified" FROM user').get()?.emailVerified,
      0
    )
  } finally {
    f.db.close()
  }
})

test("untrusted reset redirects are rejected before sending mail", async () => {
  const f = await fixture({ AUTH_PASSWORD_RESET_ENABLED: "true" }, true)
  try {
    await f.signup()
    const response = await f.request("/request-password-reset", {
      email: "person@example.test",
      redirectTo: "https://attacker.test/steal",
    })
    assert.equal(response.status, 403)
    assert.equal(f.mail.length, 0)
    assert.equal(
      f.db.prepare("SELECT count(*) AS n FROM verification").get()?.n,
      0
    )
  } finally {
    f.db.close()
  }
})

test("concurrent password resets can consume a token only once", async () => {
  const f = await fixture({ AUTH_PASSWORD_RESET_ENABLED: "true" }, true)
  try {
    await f.signup()
    await f.request("/request-password-reset", {
      email: "person@example.test",
      redirectTo: `${origin}/reset-password`,
    })
    const token = f.mail[0].token
    const responses = await Promise.all([
      f.request("/reset-password", {
        token,
        newPassword: "Concurrent-password-one!",
      }),
      f.request("/reset-password", {
        token,
        newPassword: "Concurrent-password-two!",
      }),
    ])
    assert.equal(
      responses.filter((response) => response.status === 200).length,
      1
    )
    assert.equal(
      responses.filter((response) => response.status === 400).length,
      1
    )
  } finally {
    f.db.close()
  }
})
