export const DEMO_AI_POLICY = {
  userDailyCalls: 20,
  globalDailyMicroUsd: 5_000_000,
  reservationMicroUsd: 150_000,
  cooldownMs: 60_000,
  maxConcurrent: 3,
  leaseMs: 120_000,
} as const
export type AiOutcome = "success" | "timeout" | "cancelled" | "failed"
export interface AiReservation { id: string; day: string }
export interface AiLedger {
  reserve(actorId: string): Promise<AiReservation>
  finish(id: string, outcome: AiOutcome): Promise<void>
}
