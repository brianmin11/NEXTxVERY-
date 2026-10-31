import type { AuthMailAdapter, AuthMailMessage } from "./auth-config"

export type SimulatedAuthMail = AuthMailMessage & { status: "simulated" }

/** In-memory test capture only. No transport, log, filesystem write or real delivery. */
export function createTestAuthMailAdapter({
  environment = process.env.NODE_ENV ?? "development",
  fail = false,
}: {
  environment?: string
  fail?: boolean
} = {}): AuthMailAdapter & {
  delivery: "simulated"
  outbox: SimulatedAuthMail[]
} {
  if (
    process.env.NODE_ENV === "production" ||
    !["development", "test"].includes(environment)
  ) {
    throw new Error(
      "Test auth mail capture is allowed only in development or test"
    )
  }
  const outbox: SimulatedAuthMail[] = []
  return {
    delivery: "simulated",
    outbox,
    async send(message) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("Test auth mail capture is forbidden in production")
      }
      if (fail) throw new Error("Simulated auth mail failure")
      outbox.push({ ...message, status: "simulated" })
    },
  }
}
