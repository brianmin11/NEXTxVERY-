// Explicit synthetic-only live verification; never prints cookies, keys, or private prompts.
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { DatabaseSync } from "node:sqlite"
import { existsSync } from "node:fs"
import { readFile, writeFile, mkdir } from "node:fs/promises"
const base = process.env.BASE_URL || "http://localhost:3120"
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("Local synthetic verification only")
const checkpoint = ".data/v3-live-checkpoint.json"
await mkdir(".data", { recursive: true, mode: 0o700 })
const mode = process.argv[2]
let state = existsSync(checkpoint)
  ? JSON.parse(await readFile(checkpoint, "utf8"))
  : {}
async function save() {
  await writeFile(checkpoint, JSON.stringify(state), { mode: 0o600 })
}
async function api(actor, path, method = "GET", body) {
  const response = await fetch(base + "/api/v2/" + path, {
    method,
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      Cookie: actor.cookie,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const result = await response.json()
  if (!response.ok)
    throw new Error(`${path}: ${response.status} ${result.error?.code}`)
  return result.data
}
const mutation = (actor, path, body) =>
  api(actor, path, "POST", { ...body, requestId: randomUUID() })
function persisted() {
  const db = new DatabaseSync(
    process.env.FAMILY_DB_PATH || ".data/family.sqlite",
    { readOnly: true }
  )
  try {
    return JSON.stringify({
      records: db.prepare("SELECT payload FROM v2_records").all(),
      receipts: db.prepare("SELECT result FROM v2_receipts").all(),
    })
  } finally {
    db.close()
  }
}
if (mode === "prepare") {
  if (state.actors)
    throw new Error(
      "Prepared checkpoint exists; do not recreate or reset budget"
    )
  const actors = []
  for (const [i, name] of ["합성 검증 가", "합성 검증 나"].entries()) {
    const email = `v3-live-${Date.now()}-${i}@example.test`,
      password = `Live-test-${randomUUID()}!`
    const response = await fetch(base + "/api/auth/sign-up/email", {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    })
    if (!response.ok) throw new Error(`Signup failed: ${response.status}`)
    const cookie = response.headers
        .getSetCookie()
        .map((v) => v.split(";")[0])
        .join("; "),
      result = await response.json()
    actors.push({ id: result.user.id, name, email, password, cookie })
  }
  const [a, b] = actors
  await mutation(a, "families", { name: "합성 검증 가족 v3" })
  const invite = await mutation(a, "family/invites", {})
  await mutation(b, "family/join", { inviteCode: invite.inviteCode })
  const event = await mutation(a, "calendar/events", {
    fields: {
      title: "합성 검증 저녁 준비",
      date: "2026-12-15",
      allDay: false,
      startTime: "18:00",
      endTime: "19:00",
      category: "meal",
      location: "집",
      memo: "합성 검증 일정",
      participantIds: actors.map((a) => a.id),
    },
  })
  state = {
    actors,
    eventId: event.id,
    stages: {},
    preparedAt: new Date().toISOString(),
  }
  await save()
  console.log(
    JSON.stringify({
      status: "prepared",
      syntheticActorIds: actors.map((a) => a.id),
    })
  )
} else if (mode === "live") {
  assert(state.actors, "prepare first")
  const [a, b] = state.actors
  const raw =
    "오늘 저녁 준비를 혼자 맡아 조금 지쳤어. 12월 15일에는 19시 30분부터 20시 30분까지 같이 준비해 줄 수 있는지 부드럽게 물어보고 싶어."
  if (!state.stages.shareAttempted) {
    state.stages.shareAttempted = true
    await save()
    const before = persisted()
    const suggested = await api(a, "mind/suggestions", "POST", {
      rawText: raw,
      recipientMemberId: b.id,
      clientDraftVersion: randomUUID(),
    })
    assert.equal(suggested.mode, "suggested")
    assert(suggested.text.trim())
    assert.equal(persisted(), before, "private suggestion persisted")
    assert(!persisted().includes(raw))
    // Explicit synthetic review/approval step promotes only the final outgoing text.
    const sent = await mutation(a, "mind/messages", {
      text: suggested.text,
      recipientMemberId: b.id,
    })
    assert.equal(
      (await api(b, "mind/messages/" + sent.id)).text,
      suggested.text
    )
    state.stages.sharePassed = true
    state.messageId = sent.id
    await save()
    console.log(
      JSON.stringify({
        stage: "live-private-suggestion-and-approved-send",
        passed: true,
      })
    )
  }
  assert(
    state.stages.sharePassed,
    "previous live share failed; no automatic retry"
  )
  if (!state.roomId) {
    let room = await mutation(a, "coordinations", {
      eventId: state.eventId,
      expectedEventRevision: 1,
    })
    room = await mutation(a, `coordinations/${room.id}/contributions`, {
      expectedRevision: room.revision,
      text: "저녁 준비 일정을 2026-12-15T19:30:00+09:00부터 2026-12-15T20:30:00+09:00까지로 옮기고 싶어요. 기존 일정의 시각만 변경하는 제안을 원해요.",
    })
    room = await mutation(b, `coordinations/${room.id}/contributions`, {
      expectedRevision: room.revision,
      text: "2026-12-15T19:30:00+09:00부터 2026-12-15T20:30:00+09:00까지 함께 저녁을 준비할 수 있어요. 담당자·알림·반복 설정 없이 기존 일정의 시각만 변경하는 제안을 원해요.",
    })
    state.roomId = room.id
    await save()
  }
  if (!state.stages.jointAttempted) {
    let room = await api(b, "coordinations/" + state.roomId)
    state.stages.jointAttempted = true
    await save()
    const before = persisted()
    const preview = await api(
      b,
      `coordinations/${room.id}/suggestions`,
      "POST",
      { expectedRevision: room.revision }
    )
    assert.equal(persisted(), before, "AI coordination draft persisted")
    assert.equal(typeof preview.summary, "string")
    state.stages.jointPassed = true
    state.stages.previewSupported = preview.unsupportedReasons.length === 0
    await save()
    console.log(
      JSON.stringify({
        stage: "live-joint-preview",
        passed: true,
        supported: state.stages.previewSupported,
        unsupportedCount: preview.unsupportedReasons.length,
      })
    )
    // Explicit human-approved test proposal. Unsupported model actions are never executed.
    const approved = {
      summary: "12월 15일 저녁 준비를 19:30–20:30에 함께 진행해요.",
      date: "2026-12-15",
      startTime: "19:30",
      endTime: "20:30",
    }
    room = await mutation(a, `coordinations/${room.id}/proposals`, {
      expectedRevision: room.revision,
      proposal: approved,
    })
    room = await mutation(a, `coordinations/${room.id}/decisions`, {
      expectedRevision: room.revision,
      decision: "accept",
    })
    room = await mutation(b, `coordinations/${room.id}/decisions`, {
      expectedRevision: room.revision,
      decision: "accept",
    })
    const body = { expectedRevision: room.revision, requestId: randomUUID() }
    room = await api(a, `coordinations/${room.id}/apply`, "POST", body)
    const replay = await api(a, `coordinations/${room.id}/apply`, "POST", body)
    assert.equal(replay.revision, room.revision)
    assert.equal(room.status, "applied")
    const event = await api(b, "calendar/events/" + state.eventId)
    assert.equal(event.startTime, "19:30")
    assert.equal(event.endTime, "20:30")
    assert.equal(event.revision, 2)
    state.stages.flowPassed = true
    await save()
    console.log(
      JSON.stringify({
        stage: "all-accepted-atomic-calendar-and-replay",
        passed: true,
        eventRevision: event.revision,
      })
    )
  }
} else if (mode === "check") {
  assert(state.stages.flowPassed, "live flow not complete")
  const [a, b] = state.actors
  for (const actor of [a, b]) {
    const event = await api(actor, "calendar/events/" + state.eventId)
    assert.equal(event.startTime, "19:30")
    assert.equal(event.revision, 2)
    const room = await api(actor, "coordinations/" + state.roomId)
    assert.equal(room.status, "applied")
  }
  console.log(
    JSON.stringify({
      stage: "restart-persisted-data-two-accounts",
      passed: true,
    })
  )
} else
  throw new Error(
    "Use prepare, live, or check; live is explicitly paid and not retried"
  )
