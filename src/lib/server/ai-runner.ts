import { RelationshipError, type Runner } from "@family-os/relationship-ai"
import type { AiLedger, AiOutcome } from "../../contracts/ai-operations"
// Only a committed reservation may precede outbound model I/O. Never replay a paid call.
export function withAiLedger(
  base: Runner,
  ledger: AiLedger,
  actorId: string
): Runner {
  return {
    async run(stage, schema, input, options) {
      if (options.signal?.aborted) throw new RelationshipError("CANCELLED")
      const reservation = await ledger.reserve(actorId)
      let outcome: AiOutcome = "failed"
      try {
        if (options.signal?.aborted) throw new RelationshipError("CANCELLED")
        const result = await base.run(stage, schema, input, options)
        outcome = "success"
        return result
      } catch (error) {
        if (error instanceof RelationshipError) {
          if (error.code === "TIMEOUT") outcome = "timeout"
          if (error.code === "CANCELLED") outcome = "cancelled"
        }
        throw error
      } finally {
        // On ledger outage keep the full cost reservation and let its concurrency lease expire.
        // Do not replace a successful result or retry the model due to telemetry failure.
        await ledger.finish(reservation.id, outcome).catch(() => {
          console.error("AI reservation completion deferred; charge retained")
        })
      }
    },
  }
}
