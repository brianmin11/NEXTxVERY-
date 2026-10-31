import { randomUUID } from "node:crypto"
import {
  DEMO_AI_POLICY,
  type AiLedger,
  type AiOutcome,
} from "../../contracts/ai-operations"
import type { ServiceDatabase } from "../../contracts/storage"

type LimitCode = "AI_USER_DAILY_LIMIT" | "AI_BUDGET_EXCEEDED" | "AI_RATE_LIMIT"

export class AiLimitError extends Error {
  constructor(public readonly code: LimitCode) {
    super(code)
    this.name = "AiLimitError"
  }
}

// PostgreSQL returns BIGINT aggregates as strings. Never round monetary values.
function integer(value: unknown): bigint {
  if (typeof value === "bigint" && value >= BigInt(0)) return value
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
    return BigInt(value)
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value)
  throw new Error("Invalid AI ledger counter")
}
function identifier(value: string): void {
  if (typeof value !== "string" || !value.trim())
    throw new Error("Invalid AI ledger identifier")
}
function timestamp(clock: () => number): number {
  const value = clock()
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value + 9 * 60 * 60 * 1000 > 8_640_000_000_000_000
  )
    throw new Error("Invalid AI ledger timestamp")
  return value
}
const outcomes: readonly AiOutcome[] = [
  "success",
  "timeout",
  "cancelled",
  "failed",
]

export function createAiLedger(
  db: ServiceDatabase,
  options: { now?: () => number; id?: () => string } = {}
): AiLedger {
  const now = options.now ?? Date.now
  const createId = options.id ?? randomUUID
  const policy = DEMO_AI_POLICY
  return {
    async reserve(actorId) {
      identifier(actorId)
      return db.transaction(async () => {
        // Read the clock after acquiring the lock, including the KST midnight boundary.
        const startedAt = timestamp(now)
        const day = new Date(startedAt + 9 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10)
        const actor = (await db
          .prepare(
            "SELECT COUNT(*) AS calls FROM ai_reservations WHERE actor_id=? AND day=?"
          )
          .get(actorId, day)) as { calls: unknown }
        if (integer(actor.calls) >= BigInt(policy.userDailyCalls))
          throw new AiLimitError("AI_USER_DAILY_LIMIT")

        const budget = (await db
          .prepare(
            "SELECT COALESCE(SUM(reserved_micro_usd),0) AS reserved FROM ai_reservations WHERE day=?"
          )
          .get(day)) as { reserved: unknown }
        if (
          integer(budget.reserved) + BigInt(policy.reservationMicroUsd) >
          BigInt(policy.globalDailyMicroUsd)
        )
          throw new AiLimitError("AI_BUDGET_EXCEEDED")

        const last = (await db
          .prepare(
            "SELECT MAX(started_at) AS started FROM ai_reservations WHERE actor_id=?"
          )
          .get(actorId)) as { started: unknown }
        if (
          last.started !== null &&
          BigInt(startedAt) - integer(last.started) < BigInt(policy.cooldownMs)
        )
          throw new AiLimitError("AI_RATE_LIMIT")

        // Leases from yesterday still occupy concurrency slots until finished or expired.
        const active = (await db
          .prepare(
            "SELECT COUNT(*) AS calls, COALESCE(SUM(CASE WHEN actor_id=? THEN 1 ELSE 0 END),0) AS actor_calls FROM ai_reservations WHERE finished_at IS NULL AND lease_until>?"
          )
          .get(actorId, startedAt)) as { calls: unknown; actor_calls: unknown }
        if (
          integer(active.calls) >= BigInt(policy.maxConcurrent) ||
          integer(active.actor_calls) > BigInt(0)
        )
          throw new AiLimitError("AI_RATE_LIMIT")

        const id = createId()
        identifier(id)
        await db
          .prepare(
            "INSERT INTO ai_reservations(id,actor_id,day,reserved_micro_usd,started_at,lease_until,finished_at,outcome) VALUES(?,?,?,?,?,?,NULL,NULL)"
          )
          .run(
            id,
            actorId,
            day,
            policy.reservationMicroUsd,
            startedAt,
            startedAt + policy.leaseMs
          )
        return { id, day }
      })
    },
    async finish(id, outcome) {
      identifier(id)
      if (!outcomes.includes(outcome))
        throw new Error("Invalid AI ledger outcome")
      await db.transaction(async () => {
        // First terminal result wins. Neither lease expiry nor outcome refunds a reservation.
        await db
          .prepare(
            "UPDATE ai_reservations SET finished_at=?,outcome=? WHERE id=? AND finished_at IS NULL"
          )
          .run(timestamp(now), outcome, id)
      })
    },
  }
}
