import test from "node:test"
import assert from "node:assert/strict"
import { DatabaseSync } from "node:sqlite"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import type { BetterAuthOptions } from "better-auth"

type Message = {
  kind: "verify-email" | "reset-password"
  to: string
  url: string
  token: string
}
type Receipt = { status: "provider-accepted"; provider: "resend"; id: string }
type Adapter = {
  delivery: "test-live"
  send(message: Message): Promise<void | Receipt>
}
type Environment = Record<string, string | undefined>
type Factory = (input?: {
  env?: Environment
  fetchImpl?: typeof fetch
  timeoutMs?: number
}) => Adapter | undefined
const sourceRoot = process.env.V5_AUTH_SOURCE_ROOT || process.cwd()
const { createAuthMailAdapterFromEnv } = (await import(
  pathToFileURL(resolve(sourceRoot, "src/lib/server/auth-mail-resend.ts")).href
)) as { createAuthMailAdapterFromEnv: Factory }
const { createAuthOptions } = (await import(
  pathToFileURL(resolve(sourceRoot, "src/lib/server/auth-config.ts")).href
)) as {
  createAuthOptions(input: {
    database: DatabaseSync
    env: Environment
    mailer: Adapter
  }): BetterAuthOptions
}
const recipient = "owner@example.test"
const secret = "re_synthetic_key_never_send"
const env = (extra: Environment = {}): Environment => ({
  AUTH_EMAIL_MODE: "resend-test",
  RESEND_API_KEY: secret,
  AUTH_EMAIL_TEST_RECIPIENT: recipient,
  ...extra,
})
const message = (extra: Partial<Message> = {}): Message => ({
  kind: "verify-email",
  to: recipient,
  url: "https://family.example.test/api/auth/verify-email?token=synthetic-token",
  token: "synthetic-token",
  ...extra,
})
function capture(
  response: () => Response = () =>
    Response.json({ id: "synthetic-provider-id" })
) {
  const calls: { url: string; init?: RequestInit }[] = []
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init })
    return response()
  }
  return { calls, fetchImpl }
}

test("Resend is opt-in and rejects incomplete or broader sender/recipient configuration", () => {
  const fake = capture()
  assert.equal(
    createAuthMailAdapterFromEnv({ env: {}, fetchImpl: fake.fetchImpl }),
    undefined
  )
  assert.equal(
    createAuthMailAdapterFromEnv({
      env: { AUTH_EMAIL_MODE: "disabled" },
      fetchImpl: fake.fetchImpl,
    }),
    undefined
  )
  for (const invalid of [
    { AUTH_EMAIL_MODE: "resend" },
    { RESEND_API_KEY: undefined },
    { AUTH_EMAIL_TEST_RECIPIENT: undefined },
    { AUTH_EMAIL_TEST_RECIPIENT: "owner@example.test,other@example.test" },
    { AUTH_EMAIL_TEST_RECIPIENT: "Owner <owner@example.test>" },
    {
      AUTH_EMAIL_TEST_RECIPIENT: "owner@example.test\r\nBcc:other@example.test",
    },
    { AUTH_EMAIL_FROM: "other@resend.dev" },
    { AUTH_EMAIL_FROM: "owner@custom.example.test" },
  ]) {
    assert.throws(() =>
      createAuthMailAdapterFromEnv({
        env: env(invalid),
        fetchImpl: fake.fetchImpl,
      })
    )
  }
  assert.equal(fake.calls.length, 0)
})

test("Resend test adapter sends only the exact approved recipient and returns provider acceptance", async () => {
  const fake = capture()
  const adapter = createAuthMailAdapterFromEnv({
    env: env(),
    fetchImpl: fake.fetchImpl,
  })!
  assert.equal(adapter.delivery, "test-live")
  const receipt = await adapter.send(message())
  assert.deepEqual(receipt, {
    status: "provider-accepted",
    provider: "resend",
    id: "synthetic-provider-id",
  })
  assert.equal(fake.calls.length, 1)
  const call = fake.calls[0]
  assert.equal(call.url, "https://api.resend.com/emails")
  assert.equal(call.init?.method, "POST")
  assert.equal(call.init?.redirect, "error")
  const headers = new Headers(call.init?.headers)
  assert.equal(headers.get("authorization"), `Bearer ${secret}`)
  assert.match(headers.get("content-type")!, /application\/json/)
  const body = JSON.parse(String(call.init?.body))
  assert.equal(body.from, "onboarding@resend.dev")
  assert.deepEqual(Array.isArray(body.to) ? body.to : [body.to], [recipient])
  assert.equal(body.html, undefined)
  assert.ok(body.text.includes(message().url))
  assert.ok(typeof body.subject === "string" && body.subject.length > 0)
  assert.equal(body.cc, undefined)
  assert.equal(body.bcc, undefined)
  for (const to of [
    "other@example.test",
    "Owner@example.test",
    "owner@EXAMPLE.test",
    " owner@example.test",
    "owner@example.test,other@example.test",
  ]) {
    await assert.rejects(adapter.send(message({ to })))
  }
  assert.equal(
    fake.calls.length,
    1,
    "disallowed recipients must never reach fetch or be remapped"
  )
})

test("Resend failures and malformed acceptance do not retry or expose provider data", async () => {
  for (const response of [
    () =>
      Response.json({ message: `${secret} synthetic-token` }, { status: 401 }),
    () =>
      Response.json({ message: `${secret} synthetic-token` }, { status: 429 }),
    () =>
      Response.json({ message: `${secret} synthetic-token` }, { status: 500 }),
    () => Response.json({}),
    () => new Response("not json"),
  ]) {
    const fake = capture(response)
    const adapter = createAuthMailAdapterFromEnv({
      env: env(),
      fetchImpl: fake.fetchImpl,
    })!
    await assert.rejects(adapter.send(message()), (error: unknown) => {
      assert.ok(error instanceof Error)
      assert.doesNotMatch(
        error.message,
        /re_synthetic_key|synthetic-token|owner@example.test/
      )
      return true
    })
    assert.equal(fake.calls.length, 1)
  }
  let calls = 0
  const fetchImpl: typeof fetch = async () => {
    calls++
    throw new Error(`${secret} synthetic-token`)
  }
  const adapter = createAuthMailAdapterFromEnv({ env: env(), fetchImpl })!
  await assert.rejects(adapter.send(message()), (error: unknown) => {
    assert.ok(error instanceof Error)
    assert.doesNotMatch(error.message, /re_synthetic_key|synthetic-token/)
    return true
  })
  assert.equal(calls, 1)
})

test("Resend timeout aborts a single request without retry", async () => {
  let calls = 0
  let aborted = false
  const fetchImpl: typeof fetch = async (_input, init) => {
    calls++
    return new Promise((_resolve, reject) => {
      assert.ok(init?.signal)
      init.signal.addEventListener(
        "abort",
        () => {
          aborted = true
          reject(new Error("synthetic private timeout detail"))
        },
        { once: true }
      )
    })
  }
  const adapter = createAuthMailAdapterFromEnv({
    env: env(),
    fetchImpl,
    timeoutMs: 10,
  })!
  await assert.rejects(adapter.send(message()), (error: unknown) => {
    assert.ok(error instanceof Error)
    assert.doesNotMatch(error.message, /synthetic private timeout detail/)
    return true
  })
  assert.equal(aborted, true)
  assert.equal(calls, 1)
  for (const timeoutMs of [0, -1, 10_001, Infinity]) {
    assert.throws(() =>
      createAuthMailAdapterFromEnv({ env: env(), fetchImpl, timeoutMs })
    )
  }
})

test("test-live Resend cannot enable mandatory verification even when readiness is asserted", () => {
  const db = new DatabaseSync(":memory:")
  const fake = capture()
  const mailer = createAuthMailAdapterFromEnv({
    env: env(),
    fetchImpl: fake.fetchImpl,
  })!
  const config = {
    NODE_ENV: "production",
    BETTER_AUTH_SECRET: "synthetic-secret-at-least-thirty-two-characters",
    BETTER_AUTH_URL: "https://family.example.test",
    AUTH_EMAIL_VERIFICATION_ENABLED: "true",
    AUTH_PASSWORD_RESET_ENABLED: "true",
    AUTH_EMAIL_DELIVERY_READY: "true",
  }
  try {
    assert.doesNotThrow(() =>
      createAuthOptions({ database: db, env: config, mailer })
    )
    assert.throws(() =>
      createAuthOptions({
        database: db,
        env: { ...config, AUTH_EMAIL_VERIFICATION_REQUIRED: "true" },
        mailer,
      })
    )
    assert.equal(fake.calls.length, 0)
  } finally {
    db.close()
  }
})

test("Resend timeout also bounds a transport that ignores AbortSignal", async () => {
  let calls = 0
  const fetchImpl: typeof fetch = async () => {
    calls++
    return new Promise(() => {})
  }
  const adapter = createAuthMailAdapterFromEnv({
    env: env(),
    fetchImpl,
    timeoutMs: 10,
  })!
  await assert.rejects(adapter.send(message({ kind: "reset-password" })))
  assert.equal(calls, 1)
})
