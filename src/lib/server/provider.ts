import "server-only"
import { randomUUID } from "node:crypto"
import { existsSync } from "node:fs"
import { isAbsolute } from "node:path"
import { DatabaseSync } from "node:sqlite"
import {
  createEngine,
  createRunner,
  OpenAIAdapter,
  RelationshipError,
  type Runner,
  type RunOptions,
  type ModelRunMetadata,
  type JointContext,
} from "@family-os/relationship-ai"
import { V2Error, type V2Actor } from "./v2-service"
import { getDatabase } from "./auth"
import { createAiLedger, AiLimitError } from "./ai-ledger"
import { withAiLedger } from "./ai-runner"

// Existing user-approved synthetic integration envelope, shared with the previous host.
// Reservation ceilings are conservative, not a claim about the final provider invoice.
const limits = {
  calls: 12,
  usd: 2,
  priorCalls: 109,
  priorUsd: 8.897888,
  totalCalls: 128,
  totalUsd: 12,
}
export const callOptions: RunOptions = {
  maxCalls: 1,
  maxRetries: 0,
  maxInputBytes: 32768,
  maxOutputTokens: 2600,
  timeoutMs: 60000,
  maxCostUsd: 0.15,
  price: {
    version: "openai-standard-2026-11-01",
    inputPerMillion: 2,
    outputPerMillion: 10,
  },
}
function unavailable(code = "AI_UNAVAILABLE", status = 503): never {
  throw new V2Error(
    code,
    status,
    code === "AI_USER_DAILY_LIMIT"
      ? "오늘의 AI 사용 횟수를 모두 사용했어요. 직접 작성한 내용으로 계속할 수 있어요."
      : code === "AI_TIMEOUT"
        ? "AI 응답이 늦어 요청을 종료했어요. 입력은 유지되며 직접 작성할 수 있어요."
        : code === "AI_BUDGET_EXCEEDED"
          ? "승인된 AI 사용 한도에 도달했어요. 직접 작성한 내용으로 계속할 수 있어요."
          : code === "AI_RATE_LIMIT"
            ? "AI 요청을 처리 중이에요. 잠시 후 다시 시도해 주세요."
            : "AI 제안을 완료하지 못했어요. 직접 작성한 내용으로 계속할 수 있어요."
  )
}
function safeError(error: unknown): never {
  if (error instanceof V2Error) throw error
  if (error instanceof AiLimitError) unavailable(error.code, 429)
  if (error instanceof RelationshipError) {
    if (error.code === "BUDGET_EXCEEDED") unavailable("AI_BUDGET_EXCEEDED", 429)
    if (error.code === "RATE_LIMIT") unavailable("AI_RATE_LIMIT", 429)
    if (error.code === "POLICY_RESTRICTED")
      throw new V2Error(
        "AI_POLICY_RESTRICTED",
        422,
        "이 내용은 AI 공동 조율 제안으로 만들 수 없어요. 개인 대화로 정리해 주세요."
      )
    if (error.code === "CANCELLED") unavailable("AI_CANCELLED", 409)
    if (error.code === "TIMEOUT") unavailable("AI_TIMEOUT", 504)
  }
  unavailable()
}
function getEngine(actor: V2Actor, signal?: AbortSignal) {
  if (process.env.AI_MODE === "operational") {
    if (
      process.env.AI_LIVE_APPROVED !== "true" ||
      !process.env.DATABASE_URL ||
      !process.env.OPENAI_API_KEY ||
      !actor.id
    )
      unavailable()
    const runner = withAiLedger(
      createRunner(
        new OpenAIAdapter("gpt-6.1-sol", process.env.OPENAI_API_KEY)
      ),
      createAiLedger(getDatabase()),
      actor.id
    )
    return createEngine(runner)
  }
  if (process.env.AI_MODE && process.env.AI_MODE !== "synthetic") unavailable()
  const path = process.env.INTEGRATION_BUDGET_PATH
  // This session permits synthetic evaluation only. No production entitlement is inferred.
  const actorAllowlist = (process.env.INTEGRATION_SYNTHETIC_ACTOR_IDS || "")
    .split(",")
    .filter(Boolean)
  if (
    process.env.INTEGRATION_LIVE_APPROVED !== "true" ||
    !process.env.OPENAI_API_KEY ||
    !actorAllowlist.includes(actor.id) ||
    !path ||
    !isAbsolute(path) ||
    !existsSync(path)
  )
    unavailable()
  const base = createRunner(
    new OpenAIAdapter("gpt-6.1-sol", process.env.OPENAI_API_KEY)
  )
  const runner: Runner = {
    async run(stage, schema, input, options) {
      if (signal?.aborted) throw new RelationshipError("CANCELLED")
      const db = new DatabaseSync(path)
      db.exec("PRAGMA busy_timeout=5000")
      const id = randomUUID()
      let metadata: ModelRunMetadata | undefined
      try {
        db.exec("BEGIN IMMEDIATE")
        const used = db
          .prepare(
            "SELECT count(*) calls, coalesce(sum(reserved),0) usd FROM reservations"
          )
          .get() as { calls: number; usd: number }
        if (
          used.calls >= limits.calls ||
          used.usd + callOptions.maxCostUsd > limits.usd ||
          limits.priorCalls + used.calls + 1 > limits.totalCalls ||
          limits.priorUsd + used.usd + callOptions.maxCostUsd > limits.totalUsd
        )
          throw new RelationshipError("BUDGET_EXCEEDED")
        // Rate state contains no input, output, or hashes of personal text.
        db.exec(
          "CREATE TABLE IF NOT EXISTS v3_ai_rate(actor_id TEXT PRIMARY KEY, last_started INTEGER NOT NULL)"
        )
        const last = db
          .prepare("SELECT last_started FROM v3_ai_rate WHERE actor_id=?")
          .get(actor.id) as { last_started: number } | undefined
        if (last && Date.now() - last.last_started < 60000)
          throw new RelationshipError("RATE_LIMIT")
        db.prepare(
          "INSERT INTO v3_ai_rate(actor_id,last_started) VALUES(?,?) ON CONFLICT(actor_id) DO UPDATE SET last_started=excluded.last_started"
        ).run(actor.id, Date.now())
        db.prepare(
          "INSERT INTO reservations(id,reserved,created) VALUES(?,?,?)"
        ).run(id, callOptions.maxCostUsd, new Date().toISOString())
        db.exec("COMMIT")
        try {
          return await base.run(stage, schema, input, {
            ...options,
            ...callOptions,
            signal,
            onMetadata: (value) => {
              metadata = value
            },
          })
        } finally {
          db.prepare("UPDATE reservations SET metadata=? WHERE id=?").run(
            metadata ? JSON.stringify(metadata) : null,
            id
          )
        }
      } catch (error) {
        if (db.isTransaction) db.exec("ROLLBACK")
        throw error
      } finally {
        db.close()
      }
    },
  }
  return createEngine(runner)
}
export function relationshipProvider(actor: V2Actor, signal?: AbortSignal) {
  return {
    async suggest(
      rawText: string,
      _recipientName: string,
      context: { actorId: string; recipientId: string; familyId: string }
    ) {
      try {
        if (context.actorId !== actor.id) unavailable()
        const now = new Date(),
          purpose = "mind-message"
        const result = await getEngine(actor, signal).share(
          {
            scope: {
              schemaVersion: "1.0",
              actorId: actor.id,
              householdId: context.familyId,
              participantIds: [actor.id, context.recipientId],
              now: now.toISOString(),
              timezone: "Asia/Seoul",
              purpose,
              permissionEpoch: 1,
            },
            current: {
              id: randomUUID(),
              revision: 1,
              text: rawText,
              ownerId: actor.id,
              validUntil: new Date(now.getTime() + 120000).toISOString(),
              state: "active",
            },
            memoryEnabled: false,
            historyStored: false,
            memories: [],
            route: "share",
            clarificationTurns: 0,
          },
          {
            id: randomUUID(),
            revision: 1,
            recipients: [context.recipientId],
            purpose,
            constraintsOnly: false,
          },
          { ...callOptions, signal }
        )
        // Only ephemeral exactText leaves this adapter; private provenance is never promoted or stored.
        return result.value.exactText
      } catch (error) {
        safeError(error)
      }
    },
    async propose(context: JointContext) {
      try {
        if (context.scope.actorId !== actor.id) unavailable()
        return (
          await getEngine(actor, signal).propose(
            context,
            { id: randomUUID(), revision: 1 },
            { ...callOptions, signal }
          )
        ).value
      } catch (error) {
        safeError(error)
      }
    },
  }
}
