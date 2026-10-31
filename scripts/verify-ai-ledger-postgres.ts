// Explicit recovery-schema-only synthetic concurrency verification. Never calls a model.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { parseEnv } from "node:util"
import { randomUUID } from "node:crypto"
import {
  createPostgresPool,
  createPostgresDatabase,
  databaseSchema,
} from "../src/lib/server/postgres"
import { createAiLedger, AiLimitError } from "../src/lib/server/ai-ledger"
if (process.env.STORAGE_ENV_FILE)
  Object.assign(
    process.env,
    parseEnv(readFileSync(process.env.STORAGE_ENV_FILE, "utf8"))
  )
if (
  !process.argv.includes("--verify-recovery") ||
  databaseSchema() !== "woorijip_recovery"
)
  throw Error("Explicit recovery schema verification required")
const pools = [createPostgresPool(), createPostgresPool()]
let clock = Date.parse("2099-01-01T00:00:00+09:00")
const prefix = "synthetic-ledger-" + randomUUID()
const ledgers = pools.map((p) =>
  createAiLedger(createPostgresDatabase(p), { now: () => clock })
)
try {
  assert.equal(
    Number(
      (
        await pools[0].query(
          "SELECT count(*) AS count FROM ai_reservations WHERE day='2099-01-01'"
        )
      ).rows[0].count
    ),
    0,
    "Use a fresh test day; do not overwrite evidence"
  )
  for (let i = 0; i < 20; i++) {
    const r = await ledgers[i % 2].reserve(prefix + "-user")
    await ledgers[i % 2].finish(r.id, "failed")
    clock += 60000
  }
  await assert.rejects(
    ledgers[1].reserve(prefix + "-user"),
    (e: unknown) =>
      e instanceof AiLimitError && e.code === "AI_USER_DAILY_LIMIT"
  )
  for (let i = 0; i < 12; i++) {
    const r = await ledgers[i % 2].reserve(prefix + "-" + i)
    await ledgers[i % 2].finish(r.id, "success")
  }
  const edge = await Promise.allSettled(
    ledgers.map((l, i) => l.reserve(prefix + "-edge-" + i))
  )
  assert.equal(edge.filter((r) => r.status === "fulfilled").length, 1)
  assert(
    edge.some(
      (r) =>
        r.status === "rejected" &&
        r.reason instanceof AiLimitError &&
        r.reason.code === "AI_BUDGET_EXCEEDED"
    )
  )
  const counts = (
    await pools[0].query(
      "SELECT count(*) AS calls,sum(reserved_micro_usd) AS amount FROM ai_reservations WHERE day='2099-01-01'"
    )
  ).rows[0]
  assert.equal(Number(counts.calls), 33)
  assert.equal(Number(counts.amount), 4950000)
  for (const r of edge)
    if (r.status === "fulfilled") await ledgers[0].finish(r.value.id, "success")
  clock = Date.parse("2099-01-02T00:00:00+09:00")
  const simultaneous = await Promise.allSettled(
    Array.from({ length: 4 }, (_, i) =>
      ledgers[i % 2].reserve(prefix + "-active-" + i)
    )
  )
  assert.equal(simultaneous.filter((r) => r.status === "fulfilled").length, 3)
  assert(
    simultaneous.some(
      (r) => r.status === "rejected" && r.reason.code === "AI_RATE_LIMIT"
    )
  )
  for (const r of simultaneous)
    if (r.status === "fulfilled")
      await ledgers[0].finish(r.value.id, "cancelled")
  console.log(
    JSON.stringify({
      passed: true,
      independentPools: 2,
      userDailyLimit: 20,
      globalReservedMicroUsd: 4950000,
      concurrency: 3,
      modelCalls: 0,
      schema: databaseSchema(),
    })
  )
} finally {
  await Promise.all(pools.map((p) => p.end()))
}
