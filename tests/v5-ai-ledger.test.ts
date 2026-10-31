import test from "node:test"
import assert from "node:assert/strict"
import { DatabaseSync } from "node:sqlite"
import { createAiLedger } from "../src/lib/server/ai-ledger"
import { asServiceDatabase } from "../src/lib/server/service-database"
import { DEMO_AI_POLICY, type AiOutcome } from "../src/contracts/ai-operations"
import type { ServiceDatabase } from "../src/contracts/storage"
const schema = `CREATE TABLE ai_reservations(
  id TEXT PRIMARY KEY,actor_id TEXT NOT NULL,day TEXT NOT NULL,
  reserved_micro_usd BIGINT NOT NULL,started_at BIGINT NOT NULL,lease_until BIGINT NOT NULL,
  finished_at BIGINT,outcome TEXT)`
const errorCode = (code: string) => (error: unknown) => {
  assert.equal((error as { code?: string }).code, code)
  return true
}
function fixture(start = "2026-11-01T00:00:00.000Z") {
  const raw = new DatabaseSync(":memory:")
  raw.exec(schema)
  const db = asServiceDatabase(raw)
  let now = Date.parse(start),
    sequence = 0
  const options = { now: () => now, id: () => `reservation-${++sequence}` }
  const ledger = createAiLedger(db, options)
  return {
    raw,
    db,
    options,
    ledger,
    advance: (ms: number) => {
      now += ms
    },
    rows: () =>
      raw.prepare("SELECT * FROM ai_reservations ORDER BY started_at,id").all(),
    close: () => raw.close(),
  }
}

test("twenty user calls per Seoul day are allowed, attempt twenty-one stores nothing", async () => {
  const f = fixture()
  try {
    for (let i = 0; i < 20; i++) {
      const reservation = await f.ledger.reserve("actor-a")
      assert.equal(reservation.day, "2026-11-01")
      await f.ledger.finish(reservation.id, "success")
      f.advance(DEMO_AI_POLICY.cooldownMs)
    }
    assert.equal(f.rows().length, 20)
    await assert.rejects(
      f.ledger.reserve("actor-a"),
      errorCode("AI_USER_DAILY_LIMIT")
    )
    assert.equal(f.rows().length, 20)
    assert.equal(
      f.raw
        .prepare("SELECT sum(reserved_micro_usd) total FROM ai_reservations")
        .get()?.total,
      3_000_000
    )
  } finally {
    f.close()
  }
})

test("integer global budget allows thirty-three reservations and rejects the next without refunding failures", async () => {
  const f = fixture()
  try {
    for (let i = 0; i < 33; i++) {
      const reservation = await f.ledger.reserve(`actor-${i}`)
      const outcome: AiOutcome = ["success", "failed", "timeout", "cancelled"][
        i % 4
      ] as AiOutcome
      await f.ledger.finish(reservation.id, outcome)
    }
    assert.equal(
      f.raw
        .prepare("SELECT sum(reserved_micro_usd) total FROM ai_reservations")
        .get()?.total,
      4_950_000
    )
    await assert.rejects(
      f.ledger.reserve("actor-new"),
      errorCode("AI_BUDGET_EXCEEDED")
    )
    assert.equal(f.rows().length, 33)
  } finally {
    f.close()
  }
})

test("cooldown boundary and active lease both apply after independent ledger construction", async () => {
  const f = fixture()
  try {
    const second = createAiLedger(f.db, f.options)
    const first = await f.ledger.reserve("actor-a")
    await f.ledger.finish(first.id, "failed")
    f.advance(DEMO_AI_POLICY.cooldownMs - 1)
    await assert.rejects(second.reserve("actor-a"), errorCode("AI_RATE_LIMIT"))
    f.advance(1)
    await second.reserve("actor-a")
    f.advance(DEMO_AI_POLICY.cooldownMs)
    await assert.rejects(
      f.ledger.reserve("actor-a"),
      errorCode("AI_RATE_LIMIT")
    )
    assert.equal(f.rows().length, 2)
    f.advance(DEMO_AI_POLICY.leaseMs - DEMO_AI_POLICY.cooldownMs)
    await f.ledger.reserve("actor-a")
    assert.equal(f.rows().length, 3)
  } finally {
    f.close()
  }
})

test("parallel reserves have one active call per user and at most three globally", async () => {
  const f = fixture()
  try {
    const ledgers = Array.from({ length: 8 }, () =>
      createAiLedger(f.db, f.options)
    )
    const same = await Promise.allSettled(
      ledgers.map((l) => l.reserve("same-actor"))
    )
    assert.equal(same.filter((x) => x.status === "fulfilled").length, 1)
    for (const result of same)
      if (result.status === "rejected")
        assert.equal(result.reason.code, "AI_RATE_LIMIT")
    const unique = await Promise.allSettled(
      ledgers.map((l, i) => l.reserve("other-" + i))
    )
    assert.equal(unique.filter((x) => x.status === "fulfilled").length, 2)
    assert.equal(f.rows().length, 3)
    f.advance(DEMO_AI_POLICY.leaseMs)
    await f.ledger.reserve("new-after-crash")
    assert.equal(f.rows().length, 4)
    assert.equal(
      f.raw
        .prepare("SELECT sum(reserved_micro_usd) total FROM ai_reservations")
        .get()?.total,
      600_000
    )
  } finally {
    f.close()
  }
})

test("simultaneous callers at the global budget edge cannot exceed the monetary cap", async () => {
  const f = fixture()
  try {
    for (let i = 0; i < 32; i++) {
      const r = await f.ledger.reserve("prior-" + i)
      await f.ledger.finish(r.id, "success")
    }
    const competing = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) =>
        createAiLedger(f.db, f.options).reserve("edge-" + i)
      )
    )
    assert.equal(competing.filter((r) => r.status === "fulfilled").length, 1)
    for (const r of competing)
      if (r.status === "rejected")
        assert.equal(r.reason.code, "AI_BUDGET_EXCEEDED")
    assert.equal(f.rows().length, 33)
  } finally {
    f.close()
  }
})

test("Seoul midnight resets daily budgets while past-day active leases still count", async () => {
  const f = fixture("2026-11-01T14:59:30.000Z")
  try {
    const previous = await Promise.all(
      ["a", "b", "c"].map((actor) => f.ledger.reserve(actor))
    )
    assert(previous.every((r) => r.day === "2026-11-01"))
    f.advance(30_000)
    await assert.rejects(f.ledger.reserve("d"), errorCode("AI_RATE_LIMIT"))
    await f.ledger.finish(previous[0].id, "timeout")
    const next = await f.ledger.reserve("d")
    assert.equal(next.day, "2026-11-02")
    assert.equal(f.rows().filter((r) => r.day === "2026-11-01").length, 3)
    assert.equal(f.rows().filter((r) => r.day === "2026-11-02").length, 1)
  } finally {
    f.close()
  }
})

test("a user blocked by yesterday quota is eligible again after Seoul midnight", async () => {
  const f = fixture("2026-11-01T14:00:00.000Z")
  try {
    for (let i = 0; i < 20; i++) {
      const r = await f.ledger.reserve("a")
      await f.ledger.finish(r.id, "failed")
      f.advance(60_000)
    }
    await assert.rejects(
      f.ledger.reserve("a"),
      errorCode("AI_USER_DAILY_LIMIT")
    )
    f.advance(40 * 60_000)
    const reservation = await f.ledger.reserve("a")
    assert.equal(reservation.day, "2026-11-02")
    assert.equal(f.rows().length, 21)
  } finally {
    f.close()
  }
})

test("finish is first-writer-wins and invalid outcomes never enter persisted metadata", async () => {
  const f = fixture()
  try {
    const r = await f.ledger.reserve("a")
    const privateText = "UNSENT_PRIVATE_DRAFT_qa"
    await assert.rejects(f.ledger.finish(r.id, privateText as AiOutcome))
    assert.equal(f.rows()[0].finished_at, null)
    await Promise.all([
      f.ledger.finish(r.id, "success"),
      f.ledger.finish(r.id, "failed"),
    ])
    const first = f.rows()[0]
    f.advance(1000)
    await f.ledger.finish(r.id, "timeout")
    assert.deepEqual(f.rows()[0], first)
    assert.equal(first.outcome, "success")
    assert.equal(JSON.stringify(f.rows()).includes(privateText), false)
    assert.deepEqual(
      Object.keys(first).sort(),
      [
        "id",
        "actor_id",
        "day",
        "reserved_micro_usd",
        "started_at",
        "lease_until",
        "finished_at",
        "outcome",
      ].sort()
    )
  } finally {
    f.close()
  }
})

test("failed reservation insert rolls back all accounting and does not poison subsequent requests", async () => {
  const f = fixture()
  try {
    let inject = true
    const failing: ServiceDatabase = {
      transaction: (fn) => f.db.transaction(fn),
      prepare(sql) {
        const stmt = f.db.prepare(sql)
        return {
          ...stmt,
          run: async (...params) => {
            const result = await stmt.run(...params)
            if (inject && /^\s*INSERT/i.test(sql)) {
              inject = false
              throw Error("injected post-write failure")
            }
            return result
          },
        }
      },
    }
    const ledger = createAiLedger(failing, f.options)
    await assert.rejects(ledger.reserve("a"), /injected post-write failure/)
    assert.equal(f.rows().length, 0)
    assert.equal(f.raw.isTransaction, false)
    const next = await ledger.reserve("a")
    assert(next.id)
    assert.equal(f.rows().length, 1)
  } finally {
    f.close()
  }
})

test("PostgreSQL-style aggregate numeric strings preserve exact budget arithmetic", async () => {
  const f = fixture()
  try {
    const strings = (row: unknown) =>
      row && typeof row === "object"
        ? Object.fromEntries(
            Object.entries(row).map(([k, v]) => [
              k,
              typeof v === "number" ? String(v) : v,
            ])
          )
        : row
    const db: ServiceDatabase = {
      transaction: (fn) => f.db.transaction(fn),
      prepare(sql) {
        const stmt = f.db.prepare(sql)
        return {
          run: stmt.run,
          get: async (...p) => strings(await stmt.get(...p)),
          all: async (...p) => (await stmt.all(...p)).map(strings),
        }
      },
    }
    const ledger = createAiLedger(db, f.options)
    for (let i = 0; i < 33; i++) {
      const r = await ledger.reserve("a-" + i)
      await ledger.finish(r.id, "success")
    }
    await assert.rejects(
      ledger.reserve("over"),
      errorCode("AI_BUDGET_EXCEEDED")
    )
    assert.equal(f.rows().length, 33)
  } finally {
    f.close()
  }
})

test("empty actor identity cannot create a reservation", async () => {
  const f = fixture()
  try {
    await assert.rejects(f.ledger.reserve(""))
    assert.equal(f.rows().length, 0)
  } finally {
    f.close()
  }
})
