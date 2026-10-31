import type { AuthMailAdapter, AuthMailReceipt } from "./auth-config"

/**
 * Explicit, single-recipient Resend test transport; supports local and hosted servers.
 * AUTH_EMAIL_MODE=resend-test opts in. RESEND_API_KEY stays server-side.
 * AUTH_EMAIL_FROM must be onboarding@resend.dev (default). AUTH_EMAIL_TEST_RECIPIENT
 * must be the one approved mailbox associated with the Resend account. Never remap
 * another user's recipient to it. Other modes except disabled are rejected.
 * This test-live capability cannot enable required email verification. Resend's
 * acceptance receipt is NOT proof of delivery. No retry, logging or paid-plan setup.
 * https://resend.com/docs/api-reference/emails/send-email
 * https://resend.com/docs/knowledge-base/403-error-resend-dev-domain
 */
export function createAuthMailAdapterFromEnv({
  env = process.env,
  fetchImpl = fetch,
  timeoutMs = 10000,
}: {
  env?: Record<string, string | undefined>
  fetchImpl?: typeof fetch
  timeoutMs?: number
} = {}): AuthMailAdapter | undefined {
  if (env.AUTH_EMAIL_MODE === undefined || env.AUTH_EMAIL_MODE === "disabled") {
    return undefined
  }
  if (env.AUTH_EMAIL_MODE !== "resend-test") {
    throw new Error("AUTH_EMAIL_MODE must be disabled or resend-test")
  }
  const key = env.RESEND_API_KEY
  if (!key || key.trim() !== key || /\s/.test(key)) {
    throw new Error("RESEND_API_KEY must be configured")
  }
  const from = env.AUTH_EMAIL_FROM ?? "onboarding@resend.dev"
  if (from !== "onboarding@resend.dev") {
    throw new Error("Resend test mode requires onboarding@resend.dev as sender")
  }
  const recipient = env.AUTH_EMAIL_TEST_RECIPIENT
  if (
    !recipient ||
    !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(
      recipient
    )
  ) {
    throw new Error(
      "AUTH_EMAIL_TEST_RECIPIENT must contain exactly one email address"
    )
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000) {
    throw new Error(
      "Auth mail timeout must be between 1 and 10000 milliseconds"
    )
  }
  return {
    delivery: "test-live",
    async send(message): Promise<AuthMailReceipt> {
      if (message.to !== recipient) {
        throw new Error(
          "Auth email recipient is not allowed in Resend test mode"
        )
      }
      const controller = new AbortController()
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        // Race also bounds a custom transport that ignores AbortSignal.
        return await Promise.race([
          (async () => {
            const response = await fetchImpl("https://api.resend.com/emails", {
              method: "POST",
              redirect: "error",
              signal: controller.signal,
              headers: {
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from,
                to: [message.to],
                subject:
                  message.kind === "verify-email"
                    ? "우리집 이메일 확인"
                    : "우리집 비밀번호 재설정",
                text: `${message.kind === "verify-email" ? "이메일 주소 확인" : "비밀번호 재설정"} 요청입니다. 직접 요청한 경우에만 아래 링크를 열어 주세요.\n\n${message.url}\n\n요청하지 않았다면 이 메일을 무시하세요.`,
              }),
            })
            if (!response.ok)
              throw new Error("Auth email provider rejected the request")
            const data: unknown = await response.json()
            if (
              !data ||
              typeof data !== "object" ||
              !("id" in data) ||
              typeof data.id !== "string" ||
              !/^[A-Za-z0-9_-]{1,128}$/.test(data.id)
            ) {
              throw new Error("Auth email provider response is invalid")
            }
            return {
              status: "provider-accepted" as const,
              provider: "resend" as const,
              id: data.id,
            }
          })(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              controller.abort()
              reject(new Error("Auth email request timed out"))
            }, timeoutMs)
          }),
        ])
      } catch {
        // Neither provider payloads nor fetch errors are safe to expose or log.
        throw new Error("Auth email provider request failed")
      } finally {
        if (timer !== undefined) clearTimeout(timer)
      }
    },
  }
}
