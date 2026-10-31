// Synthetic HTTP integration against an explicitly selected local server; no AI calls.
import assert from "node:assert/strict"
import { randomUUID, createHash } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import sharp from "sharp"
const base = process.env.BASE_URL || "http://localhost:3121"
const alternate = process.env.ALT_BASE_URL || base
for (const url of [base, alternate])
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname))
    throw Error("Local verification server required")
const checkpoint = ".data/v4-live-checkpoint.json"
const key = () => randomUUID()
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex")
async function call(actor, path, method = "GET", body, server = base) {
  return fetch(server + "/api/v2/" + path, {
    method,
    headers: {
      Origin: base,
      Cookie: actor?.cookie || "",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}
async function api(actor, path, method = "GET", body, server = base) {
  const response = await call(actor, path, method, body, server)
  assert(response.ok, `${path}: ${response.status}`)
  return (await response.json()).data
}
async function auth(path, data) {
  const response = await fetch(base + "/api/auth/" + path, {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  assert(response.ok, `auth: ${response.status}`)
  return {
    ...(await response.json()).user,
    cookie: response.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; "),
    ...data,
  }
}
if (process.argv[2] === "check") {
  const state = JSON.parse(await readFile(checkpoint, "utf8"))
  for (const actor of state.actors.slice(0, 2)) {
    const event = await api(actor, "calendar/events/" + state.event.id)
    assert.equal(event.revision, 2)
    const response = await call(
      actor,
      "memories/assets/" + state.asset.id + "/content"
    )
    assert.equal(response.status, 200)
    assert.equal(
      digest(new Uint8Array(await response.arrayBuffer())),
      state.assetHash
    )
  }
  assert.equal(
    (
      await call(
        state.actors[2],
        "memories/assets/" + state.asset.id + "/content"
      )
    ).status,
    404
  )
  console.log(
    JSON.stringify({
      stage: "persistent-calendar-photo-two-accounts",
      passed: true,
    })
  )
} else if (process.argv[2] === "prepare") {
  if (existsSync(checkpoint))
    throw Error("Checkpoint exists; use check without creating new accounts")
  // Verify migrated password hashes, not only previously issued cookies.
  const prior = JSON.parse(
    await readFile(".data/v3-live-checkpoint.json", "utf8")
  )
  for (const old of prior.actors) {
    const signed = await auth("sign-in/email", {
      email: old.email,
      password: old.password,
    })
    assert.equal(signed.id, old.id)
    await api(signed, "calendar/events/" + prior.eventId)
  }
  const actors = []
  for (const name of ["저장소 검증 가", "저장소 검증 나", "다른 가족 검증"])
    actors.push(
      await auth("sign-up/email", {
        name,
        email: `storage-${key()}@example.test`,
        password: `Storage-${key()}!`,
      })
    )
  const [a, b, c] = actors
  const post = (actor, path, body = {}) =>
    api(actor, path, "POST", { ...body, requestId: key() })
  await post(a, "families", { name: "운영 저장소 합성 검증 가족" })
  const invite = await post(a, "family/invites")
  await post(b, "family/join", { inviteCode: invite.inviteCode })
  await post(c, "families", { name: "접근 차단 검증 가족" })
  const eventBody = {
    requestId: key(),
    fields: {
      title: "운영 DB 동시 저장 검증",
      date: "2026-12-16",
      allDay: false,
      startTime: "18:00",
      endTime: "19:00",
      category: "meal",
      location: "집",
      memo: "합성 검증",
      participantIds: [a.id, b.id],
    },
  }
  const events = await Promise.all([
    api(a, "calendar/events", "POST", eventBody),
    api(a, "calendar/events", "POST", eventBody, alternate),
  ])
  assert.equal(events[0].id, events[1].id)
  const event = events[0]
  const edits = await Promise.all([
    call(a, "calendar/events/" + event.id, "PATCH", {
      requestId: key(),
      expectedRevision: 1,
      fields: { ...eventBody.fields, title: "운영 DB 충돌 검증 A" },
    }),
    call(
      a,
      "calendar/events/" + event.id,
      "PATCH",
      {
        requestId: key(),
        expectedRevision: 1,
        fields: { ...eventBody.fields, title: "운영 DB 충돌 검증 B" },
      },
      alternate
    ),
  ])
  assert.deepEqual(edits.map((r) => r.status).sort(), [200, 409])
  assert.equal((await call(c, "calendar/events/" + event.id)).status, 404)
  const bytes = await sharp({
    create: { width: 16, height: 16, channels: 3, background: "#7a9b60" },
  })
    .png()
    .toBuffer()
  const form = new FormData()
  form.append("file", new File([bytes], "synthetic.png", { type: "image/png" }))
  const upload = await fetch(base + "/api/v2/memories/assets", {
    method: "POST",
    headers: { Origin: base, Cookie: a.cookie },
    body: form,
  })
  assert.equal(upload.status, 201)
  const asset = (await upload.json()).data
  assert.equal(
    (await call(b, "memories/assets/" + asset.id + "/content")).status,
    404
  )
  const memory = await post(a, "memories", {
    fields: {
      assetId: asset.id,
      memoryDate: "2026-11-01",
      caption: "비공개 저장소 합성 사진",
    },
  })
  const content = await call(b, "memories/assets/" + asset.id + "/content")
  assert.equal(content.status, 200)
  const photo = new Uint8Array(await content.arrayBuffer())
  assert.equal((await sharp(photo).metadata()).format, "webp")
  assert.equal(
    (await call(c, "memories/assets/" + asset.id + "/content")).status,
    404
  )
  assert.equal(
    (await call(null, "memories/assets/" + asset.id + "/content")).status,
    401
  )
  const raw = "비보관 검증-" + key()
  assert.equal(
    (
      await call(a, "mind/suggestions", "POST", {
        rawText: raw,
        recipientMemberId: b.id,
        clientDraftVersion: 1,
      })
    ).status,
    503
  )
  await writeFile(
    checkpoint,
    JSON.stringify({
      actors,
      event,
      asset,
      memory,
      assetHash: digest(photo),
      raw,
    }),
    { mode: 0o600, flag: "wx" }
  )
  console.log(
    JSON.stringify({
      stage:
        "migrated-password-signin-new-signup-two-process-concurrency-private-photo-isolation",
      passed: true,
      aiCalls: 0,
    })
  )
} else throw Error("Use prepare or check")
