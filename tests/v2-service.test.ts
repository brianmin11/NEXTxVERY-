import test from "node:test"
import assert from "node:assert/strict"
import { DatabaseSync } from "node:sqlite"
import { readFileSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import sharp from "sharp"
import { createV2Service } from "../src/lib/server/v2-service"

type Actor = { id: string; name: string; email: string }
const actor = (name: string): Actor => ({
  id: randomUUID(),
  name,
  email: `${randomUUID()}@example.test`,
})
const key = () => randomUUID()
type Row = { id: string; revision: number; [key: string]: unknown }
async function fixture(
  suggest?: (raw: string, name: string) => Promise<string>
) {
  const dir = mkdtempSync(join(tmpdir(), "family-v2-qa-"))
  const db = new DatabaseSync(":memory:")
  db.exec("PRAGMA foreign_keys=ON")
  db.exec(
    readFileSync(new URL("../migrations/002-v2.sql", import.meta.url), "utf8")
  )
  const service = createV2Service({
    db,
    uploadDir: dir,
    suggest,
    inviteSecret: "synthetic-test-invite-secret-at-least-32-characters",
  })
  const a = actor("가족 A"),
    b = actor("가족 B"),
    c = actor("같은 가족 C"),
    outsider = actor("다른 가족")
  const call = async <T = Row>(
    who: Actor,
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> => (await service.request(who, method, path, body)) as T
  await call(a, "POST", "families", { name: "우리집", requestId: key() })
  const invite = await call<{ inviteCode: string }>(
    a,
    "POST",
    "family/invites",
    { requestId: key() }
  )
  for (const who of [b, c])
    await call(who, "POST", "family/join", {
      inviteCode: invite.inviteCode,
      requestId: key(),
    })
  await call(outsider, "POST", "families", { name: "다른집", requestId: key() })
  return {
    db,
    service,
    a,
    b,
    c,
    outsider,
    call,
    invite,
    dispose() {
      db.close()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}
const rejectsStatus = async (action: () => Promise<unknown>, status: number) =>
  assert.rejects(action, (e: unknown) => {
    assert.equal((e as { status: number }).status, status)
    return true
  })
const eventFields = (ids: string[]) => ({
  title: "가족 저녁",
  category: "meal",
  date: "2028-02-29",
  allDay: false,
  startTime: "19:00",
  endTime: "20:00",
  location: "우리집",
  memo: "함께 준비해요",
  participantIds: ids,
})
const choreFields = (id: string) => ({
  title: "설거지",
  memo: "식사 후",
  assigneeMemberId: id,
  dueDate: "2028-02-29",
})

test("session identifies actual member; invite secret is hashed and family data isolated", async () => {
  const f = await fixture()
  try {
    const session = await f.call<{
      viewer: { id: string }
      family: { members: { id: string }[] }
    }>(f.b, "GET", "session")
    assert.equal(session.viewer.id, f.b.id)
    assert.equal(session.family.members.length, 3)
    assert.equal(JSON.stringify(session).includes(f.a.email), false)
    const rows = f.db.prepare("SELECT * FROM v2_invites").all()
    assert.equal(JSON.stringify(rows).includes(f.invite.inviteCode), false)
    assert.ok(rows.length > 0)
    assert.equal(JSON.stringify(f.db.prepare("SELECT * FROM v2_receipts").all()).includes(f.invite.inviteCode), false)
    const noFamily = await f.call<{ family: null }>(
      actor("새 계정"),
      "GET",
      "session"
    )
    assert.equal(noFamily.family, null)
  } finally {
    f.dispose()
  }
})

test("calendar preserves local dates and enforces actor, participants, revision and idempotency", async () => {
  const f = await fixture()
  try {
    const requestId = key(),
      fields = eventFields([f.a.id, f.b.id])
    const created = await f.call(f.a, "POST", "calendar/events", {
      fields,
      requestId,
    })
    assert.equal(created.date, "2028-02-29")
    assert.equal(created.startTime, "19:00")
    assert.equal(created.createdByMemberId, f.a.id)
    const retry = await f.call(f.a, "POST", "calendar/events", {
      fields,
      requestId,
    })
    assert.equal(retry.id, created.id)
    assert.equal((await f.call<Row[]>(f.b, "GET", "calendar/events")).length, 1)
    assert.equal(
      (await f.call<Row[]>(f.outsider, "GET", "calendar/events")).length,
      0
    )
    await rejectsStatus(
      () =>
        f.call(f.a, "POST", "calendar/events", {
          fields: { ...fields, title: "다른 요청" },
          requestId,
        }),
      409
    )
    await rejectsStatus(
      () =>
        f.call(f.b, "PATCH", `calendar/events/${created.id}`, {
          fields,
          expectedRevision: created.revision,
          requestId: key(),
        }),
      403
    )
    await rejectsStatus(
      () => f.call(f.outsider, "GET", `calendar/events/${created.id}`),
      404
    )
    const changed = await f.call(
      f.a,
      "PATCH",
      `calendar/events/${created.id}`,
      {
        fields: { ...fields, allDay: true, startTime: null, endTime: null },
        expectedRevision: created.revision,
        requestId: key(),
      }
    )
    assert.equal(changed.allDay, true)
    assert.equal(changed.startTime, null)
    await rejectsStatus(
      () =>
        f.call(f.a, "PATCH", `calendar/events/${created.id}`, {
          fields,
          expectedRevision: created.revision,
          requestId: key(),
        }),
      409
    )
    const deleteKey = key()
    await f.call(f.a, "DELETE", `calendar/events/${created.id}`, {
      expectedRevision: changed.revision,
      requestId: deleteKey,
    })
    await f.call(f.a, "DELETE", `calendar/events/${created.id}`, {
      expectedRevision: changed.revision,
      requestId: deleteKey,
    })
    assert.equal((await f.call<Row[]>(f.a, "GET", "calendar/events")).length, 0)
  } finally {
    f.dispose()
  }
})

test("invalid calendar requests roll back without reserving request key", async () => {
  const f = await fixture()
  try {
    const requestId = key(),
      fields = eventFields([f.a.id])
    await rejectsStatus(
      () =>
        f.call(f.a, "POST", "calendar/events", {
          fields: { ...fields, date: "2026-02-30" },
          requestId,
        }),
      422
    )
    assert.equal(
      f.db
        .prepare(
          "SELECT count(*) AS n FROM v2_receipts WHERE actor_id=? AND request_id=?"
        )
        .get(f.a.id, requestId)?.n,
      0
    )
    await f.call(f.a, "POST", "calendar/events", { fields, requestId })
    for (const patch of [
      { title: " ".repeat(5) },
      { title: "가".repeat(41) },
      { endTime: "18:00" },
      { participantIds: [f.outsider.id] },
    ]) {
      await rejectsStatus(
        () =>
          f.call(f.a, "POST", "calendar/events", {
            fields: { ...fields, ...patch },
            requestId: key(),
          }),
        422
      )
    }
  } finally {
    f.dispose()
  }
})

test("chores enforce author/assignee rules, explicit state and completion timestamp stability", async () => {
  const f = await fixture()
  try {
    const fields = choreFields(f.b.id),
      chore = await f.call(f.a, "POST", "chores", { fields, requestId: key() })
    await rejectsStatus(
      () =>
        f.call(f.c, "PUT", `chores/${chore.id}/status`, {
          status: "done",
          expectedRevision: chore.revision,
          requestId: key(),
        }),
      403
    )
    await rejectsStatus(
      () =>
        f.call(f.b, "PATCH", `chores/${chore.id}`, {
          fields,
          expectedRevision: chore.revision,
          requestId: key(),
        }),
      403
    )
    const done = await f.call(f.b, "PUT", `chores/${chore.id}/status`, {
      status: "done",
      expectedRevision: chore.revision,
      requestId: key(),
    })
    assert.equal(done.status, "done")
    assert.equal(done.completedByMemberId, f.b.id)
    assert.ok(done.completedAt)
    const repeated = await f.call(f.b, "PUT", `chores/${chore.id}/status`, {
      status: "done",
      expectedRevision: done.revision,
      requestId: key(),
    })
    assert.equal(repeated.completedAt, done.completedAt)
    assert.equal(repeated.status, "done")
    await rejectsStatus(
      () =>
        f.call(f.a, "PATCH", `chores/${chore.id}`, {
          fields,
          expectedRevision: repeated.revision,
          requestId: key(),
        }),
      403
    )
    const undone = await f.call(f.a, "PUT", `chores/${chore.id}/status`, {
      status: "todo",
      expectedRevision: repeated.revision,
      requestId: key(),
    })
    assert.equal(undone.completedAt, null)
    assert.equal(undone.completedByMemberId, null)
    await rejectsStatus(
      () => f.call(f.outsider, "GET", `chores/${chore.id}`),
      404
    )
    await rejectsStatus(
      () =>
        f.call(f.a, "POST", "chores", {
          fields: { ...fields, assigneeMemberId: f.outsider.id },
          requestId: key(),
        }),
      422
    )
  } finally {
    f.dispose()
  }
})

test("mind suggestions are ephemeral, final messages restricted, read does not downgrade responses", async () => {
  const raw = "QA_PRIVATE_RAW_" + key(),
    suggested = "QA_UNSENT_DRAFT_" + key()
  let calls = 0
  const f = await fixture(async (input, name) => {
    assert.equal(input, raw)
    assert.equal(name, "가족 B")
    calls++
    return suggested
  })
  try {
    const draft = await f.call(f.a, "POST", "mind/suggestions", {
      rawText: raw,
      recipientMemberId: f.b.id,
      clientDraftVersion: 4,
    })
    assert.equal(draft.text, suggested)
    assert.equal(draft.clientDraftVersion, 4)
    assert.equal(calls, 1)
    for (const table of ["v2_records", "v2_receipts"]) {
      const all = JSON.stringify(f.db.prepare(`SELECT * FROM ${table}`).all())
      assert.equal(all.includes(raw), false)
      assert.equal(all.includes(suggested), false)
    }
    const requestId = key()
    const message = await f.call(f.a, "POST", "mind/messages", {
      text: "오늘 저녁에 이야기 나눌까요?",
      recipientMemberId: f.b.id,
      requestId,
    })
    const duplicate = await f.call(f.a, "POST", "mind/messages", {
      text: "오늘 저녁에 이야기 나눌까요?",
      recipientMemberId: f.b.id,
      requestId,
    })
    assert.equal(duplicate.id, message.id)
    for (const other of [f.c, f.outsider]) {
      assert.equal(
        (await f.call<Row[]>(other, "GET", "mind/messages")).length,
        0
      )
      await rejectsStatus(
        () => f.call(other, "GET", `mind/messages/${message.id}`),
        404
      )
    }
    const read = await f.call(f.b, "PUT", `mind/messages/${message.id}/read`, {
      requestId: key(),
    })
    assert.equal(read.status, "read")
    await rejectsStatus(
      () =>
        f.call(f.a, "PUT", `mind/messages/${message.id}/response`, {
          response: { kind: "reply", text: "대신 응답" },
          expectedRevision: read.revision,
          requestId: key(),
        }),
      403
    )
    const response = await f.call(
      f.b,
      "PUT",
      `mind/messages/${message.id}/response`,
      {
        response: { kind: "reply", text: "좋아요" },
        expectedRevision: read.revision,
        requestId: key(),
      }
    )
    assert.equal(response.status, "replied")
    const reread = await f.call(
      f.b,
      "PUT",
      `mind/messages/${message.id}/read`,
      { requestId: key() }
    )
    assert.equal(reread.status, "replied")
  } finally {
    f.dispose()
  }
})

test("unconfigured AI fails explicitly but manual message delivery remains usable", async () => {
  const f = await fixture()
  try {
    await rejectsStatus(
      () =>
        f.call(f.a, "POST", "mind/suggestions", {
          rawText: "나만 보는 문장",
          recipientMemberId: f.b.id,
          clientDraftVersion: 1,
        }),
      503
    )
    const result = await f.call(f.a, "POST", "mind/messages", {
      text: "직접 다듬은 전달 문장",
      recipientMemberId: f.b.id,
      requestId: key(),
    })
    assert.equal(result.text, "직접 다듬은 전달 문장")
  } finally {
    f.dispose()
  }
})

test("private images validate bytes, restrict pending assets, attach and delete atomically", async () => {
  const f = await fixture()
  try {
    const bytes = await sharp({
      create: { width: 16, height: 12, channels: 3, background: "#abc" },
    })
      .png()
      .toBuffer()
    const asset = await f.service.upload(f.a, bytes, "image/png")
    assert.equal(asset.kind, "remote")
    assert.equal(asset.width, 16)
    assert.equal(asset.height, 12)
    await f.service.content(f.a, asset.id)
    await rejectsStatus(() => f.service.content(f.b, asset.id), 404)
    await rejectsStatus(() => f.service.content(f.outsider, asset.id), 404)
    await rejectsStatus(
      () =>
        f.call(f.b, "POST", "memories", {
          fields: {
            assetId: asset.id,
            memoryDate: "2026-11-01",
            caption: "타인 자산",
          },
          requestId: key(),
        }),
      404
    )
    const requestId = key(),
      fields = {
        assetId: asset.id,
        memoryDate: "2026-11-01",
        caption: "가족 사진",
      }
    const post = await f.call(f.a, "POST", "memories", { fields, requestId })
    const repeat = await f.call(f.a, "POST", "memories", { fields, requestId })
    assert.equal(repeat.id, post.id)
    const viewed = await f.service.content(f.b, asset.id)
    assert.ok(viewed.bytes.byteLength > 0)
    await rejectsStatus(() => f.service.content(f.outsider, asset.id), 404)
    await rejectsStatus(
      () =>
        f.call(f.b, "DELETE", `memories/${post.id}`, {
          expectedRevision: post.revision,
          requestId: key(),
        }),
      403
    )
    const deletion = key()
    await f.call(f.a, "DELETE", `memories/${post.id}`, {
      expectedRevision: post.revision,
      requestId: deletion,
    })
    await f.call(f.a, "DELETE", `memories/${post.id}`, {
      expectedRevision: post.revision,
      requestId: deletion,
    })
    await rejectsStatus(() => f.service.content(f.a, asset.id), 404)
    await assert.rejects(() =>
      f.service.upload(f.a, new Uint8Array([1, 2, 3]), "image/png")
    )
    await rejectsStatus(
      () => f.service.upload(f.a, bytes, "image/svg+xml"),
      415
    )
    await rejectsStatus(
      () =>
        f.service.upload(
          f.a,
          new Uint8Array(10 * 1024 * 1024 + 1),
          "image/png"
        ),
      413
    )
    assert.equal(await f.service.cleanup(), 0)
  } finally {
    f.dispose()
  }
})

test("competing revisions admit exactly one write and pending upload cleanup leaves attached assets intact", async () => {
  const f = await fixture()
  try {
    const fields = eventFields([f.a.id])
    const event = await f.call(f.a, "POST", "calendar/events", {
      fields,
      requestId: key(),
    })
    const results = await Promise.allSettled(
      ["첫 변경", "두 번째 변경"].map((title) =>
        f.call(f.a, "PATCH", `calendar/events/${event.id}`, {
          fields: { ...fields, title },
          expectedRevision: event.revision,
          requestId: key(),
        })
      )
    )
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1)
    const failed = results.find((r) => r.status === "rejected")
    assert.equal(failed?.status === "rejected" && failed.reason.status, 409)
    const bytes = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "#aab" },
    })
      .webp()
      .toBuffer()
    const orphan = await f.service.upload(f.a, bytes, "image/webp")
    const attached = await f.service.upload(f.a, bytes, "image/webp")
    await f.call(f.a, "POST", "memories", {
      fields: {
        assetId: attached.id,
        memoryDate: "2026-11-01",
        caption: "보존할 사진",
      },
      requestId: key(),
    })
    for (const id of [orphan.id, attached.id]) {
      const row = f.db
        .prepare("SELECT payload FROM v2_records WHERE id=? AND kind='asset'")
        .get(id) as { payload: string }
      const payload = JSON.parse(row.payload)
      payload.createdAt = new Date(Date.now() - 48 * 3600 * 1000).toISOString()
      f.db
        .prepare("UPDATE v2_records SET payload=? WHERE id=?")
        .run(JSON.stringify(payload), id)
    }
    assert.equal(await f.service.cleanup(), 1)
    await rejectsStatus(() => f.service.content(f.a, orphan.id), 404)
    await f.service.content(f.b, attached.id)
  } finally {
    f.dispose()
  }
})
