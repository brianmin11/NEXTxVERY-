import test from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { z } from "zod"
import {
  createRunner,
  RelationshipError,
  type ModelAdapter,
  type Runner,
} from "@family-os/relationship-ai"
import { withAiLedger } from "../src/lib/server/ai-runner"
import type { AiLedger, AiOutcome } from "../src/contracts/ai-operations"

test("operational authenticated actor uses central reservations without synthetic allowlist or private text persistence", () => {
  const source = `
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {asServiceDatabase} from './src/lib/server/service-database.ts';
const db = new DatabaseSync(':memory:');
db.exec(readFileSync('migrations/postgres/002-ai-operations.sql','utf8'));
globalThis.serviceDb = asServiceDatabase(db);
process.env.AI_MODE='operational';process.env.AI_LIVE_APPROVED='false';
process.env.DATABASE_URL='postgresql://synthetic-unused.invalid/postgres';
process.env.OPENAI_API_KEY='synthetic-not-real';
process.env.INTEGRATION_LIVE_APPROVED='false';delete process.env.INTEGRATION_SYNTHETIC_ACTOR_IDS;
let calls=0;
const raw='private raw never persisted',draft='private draft never persisted';
globalThis.fetch=async (_url,init)=>{calls++;const b=JSON.parse(init.body);assert.equal(b.store,false);assert.equal(b.max_output_tokens,2600);const input=JSON.parse(b.input);const value={schemaVersion:'1.0',id:input.settings.id,revision:1,status:'draft',exactText:draft,recipients:input.settings.recipients,purpose:input.settings.purpose,reviewItems:[],safetyDisposition:'ordinary'};return new Response(JSON.stringify({id:'fake-response',object:'response',created_at:0,status:'completed',model:b.model,output:[{id:'fake-message',type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(value),annotations:[]}]}],usage:{input_tokens:10,output_tokens:10}}),{status:200,headers:{'content-type':'application/json'}})};
const {relationshipProvider}=await import('./src/lib/server/provider.ts');
const provider=relationshipProvider({id:'normal-account',name:'합성검증'});
const invoke=()=>provider.suggest(raw,'recipient',{actorId:'normal-account',recipientId:'recipient',familyId:'family'});
await assert.rejects(invoke,e=>e.code==='AI_UNAVAILABLE');assert.equal(calls,0);
process.env.AI_LIVE_APPROVED='true';delete process.env.DATABASE_URL;
await assert.rejects(invoke,e=>e.code==='AI_UNAVAILABLE');assert.equal(calls,0);
process.env.DATABASE_URL='postgresql://synthetic-unused.invalid/postgres';
assert.equal(await invoke(),draft);assert.equal(calls,1);
await assert.rejects(invoke,e=>e.code==='AI_RATE_LIMIT'&&e.status===429);assert.equal(calls,1);
const rows=db.prepare('SELECT * FROM ai_reservations').all();assert.equal(rows.length,1);assert.equal(rows[0].outcome,'success');assert.equal(rows[0].reserved_micro_usd,150000);assert(!JSON.stringify(rows).includes(raw));assert(!JSON.stringify(rows).includes(draft));
db.close();process.stdout.write('passed');
`
  assert.equal(
    execFileSync(
      process.execPath,
      [
        "--conditions=react-server",
        "--import",
        "tsx",
        "--input-type=module",
        "-e",
        source,
      ],
      { encoding: "utf8", timeout: 15000, stdio: ["ignore", "pipe", "pipe"] }
    ).trim(),
    "passed"
  )
})

function fixture(failFinish = false) {
  let reservations = 0
  const outcomes: AiOutcome[] = []
  const ledger: AiLedger = {
    reserve: async () => {
      reservations++
      return { id: "reservation", day: "2026-11-01" }
    },
    finish: async (_id, outcome) => {
      outcomes.push(outcome)
      if (failFinish) throw Error("offline")
    },
  }
  return { ledger, outcomes, count: () => reservations }
}
const options = {
  maxCalls: 1,
  maxRetries: 0,
  maxInputBytes: 32768,
  maxOutputTokens: 100,
  timeoutMs: 15,
  maxCostUsd: 0.15,
  price: { version: "test-only", inputPerMillion: 2, outputPerMillion: 10 },
}
test("timeout ends unresponsive provider, retains reservation, and records a sanitized outcome", async () => {
  const f = fixture()
  const adapter: ModelAdapter = {
    name: "synthetic",
    model: "synthetic",
    generate: async () => new Promise(() => {}),
  }
  await assert.rejects(
    withAiLedger(createRunner(adapter), f.ledger, "actor").run(
      "share",
      z.object({ value: z.string() }),
      { private: "raw" },
      options
    ),
    (e: unknown) => e instanceof RelationshipError && e.code === "TIMEOUT"
  )
  assert.equal(f.count(), 1)
  assert.deepEqual(f.outcomes, ["timeout"])
})
test("pre-aborted request never reserves or calls model; failed completion never retries paid generation", async () => {
  const f = fixture(true)
  let calls = 0
  const base: Runner = {
    run: async () => {
      calls++
      throw new RelationshipError("PROVIDER_ERROR")
    },
  }
  const runner = withAiLedger(base, f.ledger, "actor"),
    controller = new AbortController()
  controller.abort()
  await assert.rejects(
    runner.run(
      "share",
      z.object({}),
      {},
      { ...options, signal: controller.signal }
    ),
    (e: unknown) => e instanceof RelationshipError && e.code === "CANCELLED"
  )
  assert.equal(f.count(), 0)
  assert.equal(calls, 0)
  await assert.rejects(
    runner.run("share", z.object({}), {}, options),
    (e: unknown) =>
      e instanceof RelationshipError && e.code === "PROVIDER_ERROR"
  )
  assert.equal(f.count(), 1)
  assert.equal(calls, 1)
  assert.deepEqual(f.outcomes, ["failed"])
})
