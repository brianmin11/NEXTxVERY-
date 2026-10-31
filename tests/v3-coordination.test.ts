import test from "node:test"
import assert from "node:assert/strict"
import { DatabaseSync } from "node:sqlite"
import { readFileSync } from "node:fs"
import { randomUUID } from "node:crypto"
import type { AgreementDraft, JointContext } from "@family-os/relationship-ai"
import { createV2Service, type V2Actor } from "../src/lib/server/v2-service"
import { createCoordinationService } from "../src/lib/server/v3-coordination"
import type {
  CoordinationRoom,
  CoordinationPreview,
  CoordinationProposal,
} from "../src/contracts/coordination"
import type { CalendarEvent } from "../lib/calendar/types"

const key = () => randomUUID()
const actor = (name: string): V2Actor => ({ id: key(), name })
const proposal: CoordinationProposal = {
  summary: "저녁을 한 시간 늦춰 함께 먹어요",
  date: "2028-02-29",
  startTime: "20:00",
  endTime: "21:00",
}
const fields = (ids: string[]) => ({
  title: "함께 저녁",
  category: "meal",
  date: "2028-02-29",
  allDay: false,
  startTime: "19:00",
  endTime: "20:00",
  location: "집",
  memo: "그대로 보존할 메모",
  participantIds: ids,
})
async function rejected(run: () => Promise<unknown>, status: number) {
  await assert.rejects(run, (error: unknown) => {
    assert.equal((error as { status: number }).status, status)
    return true
  })
}
async function fixture(
  propose?: (context: JointContext) => Promise<AgreementDraft>
) {
  const db = new DatabaseSync(":memory:")
  db.exec(
    readFileSync(new URL("../migrations/002-v2.sql", import.meta.url), "utf8")
  )
  const v2 = createV2Service({
    db,
    inviteSecret: "qa-invite-key-at-least-32-characters-long",
  })
  const service = createCoordinationService({ db, propose })
  const a = actor("작성자"),
    b = actor("참여자"),
    c = actor("비참여 가족"),
    outsider = actor("다른 가족")
  const legacy = async <T = unknown>(
    who: V2Actor,
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> => (await v2.request(who, method, path, body)) as T
  const call = async <T = CoordinationRoom>(
    who: V2Actor,
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> => (await service.request(who, method, path, body)) as T
  await legacy(a, "POST", "families", { name: "조율 가족", requestId: key() })
  const invite = await legacy<{ inviteCode: string }>(
    a,
    "POST",
    "family/invites",
    { requestId: key() }
  )
  for (const who of [b, c])
    await legacy(who, "POST", "family/join", {
      inviteCode: invite.inviteCode,
      requestId: key(),
    })
  await legacy(outsider, "POST", "families", {
    name: "다른 집",
    requestId: key(),
  })
  const event = await legacy<CalendarEvent & { revision: number }>(
    a,
    "POST",
    "calendar/events",
    { fields: fields([a.id, b.id]), requestId: key() }
  )
  const room = await call(a, "POST", "coordinations", {
    eventId: event.id,
    expectedEventRevision: event.revision,
    requestId: key(),
  })
  const mutate = (
    who: V2Actor,
    current: CoordinationRoom,
    action: string,
    body: Record<string, unknown> = {}
  ) =>
    call(who, "POST", `coordinations/${current.id}/${action}`, {
      expectedRevision: current.revision,
      requestId: key(),
      ...body,
    })
  const getEvent = () =>
    legacy<CalendarEvent & { revision: number }>(
      a,
      "GET",
      `calendar/events/${event.id}`
    )
  return {
    db,
    service,
    a,
    b,
    c,
    outsider,
    event,
    room,
    legacy,
    call,
    mutate,
    getEvent,
    close: () => db.close(),
  }
}
type Fixture = Awaited<ReturnType<typeof fixture>>
async function approved(f: Fixture) {
  let room = await f.mutate(f.a, f.room, "contributions", {
    text: "저녁은 20시에 함께 먹고 싶어요",
  })
  room = await f.mutate(f.b, room, "contributions", {
    text: "20시에 집에 도착해요",
  })
  room = await f.mutate(f.a, room, "proposals", { proposal })
  assert.equal(room.decisions.length, 0, "publishing must not imply acceptance")
  room = await f.mutate(f.a, room, "decisions", { decision: "accept" })
  return f.mutate(f.b, room, "decisions", { decision: "accept" })
}
function generated(context: JointContext): AgreementDraft {
  return {
    schemaVersion: "1.0",
    id: "synthetic-agreement",
    revision: 1,
    status: "draft",
    parties: context.scope.participantIds,
    summary: "UNSAVED_AI_PREVIEW",
    options: [],
    unknowns: [],
    changes: [],
    acceptanceInheritance: false,
    actions: [
      {
        kind: "schedule_update",
        targetId: context.schedules[0].id,
        assigneeId: null,
        description: "식사 시간을 옮기는 제안",
        start: "2028-02-29T11:00:00Z",
        end: "2028-02-29T12:00:00Z",
        deadline: null,
        recurrence: "none",
        weekdays: [],
        until: null,
        preparation: null,
        followup: null,
        exception: null,
        reminderRecipients: [],
        reminderAt: null,
        maxReminders: 0,
        basis: "proposed",
        evidence: [
          {
            sourceId: context.cards[0].id,
            revision: context.cards[0].revision,
            quote: context.cards[0].exactText,
          },
        ],
        unresolvedFields: [],
      },
    ],
  }
}

test("two parties explicitly accept one proposal; atomic apply preserves event identity and unrelated fields", async () => {
  const f = await fixture()
  try {
    const room = await approved(f)
    assert.ok(room.proposal?.digest)
    assert.equal(room.decisions.length, 2)
    assert.ok(
      room.decisions.every((item) => item.digest === room.proposal?.digest)
    )
    const requestId = key(),
      body = { expectedRevision: room.revision, requestId }
    const applied = await f.call(
      f.a,
      "POST",
      `coordinations/${room.id}/apply`,
      body
    )
    assert.equal(applied.status, "applied")
    const after = await f.getEvent()
    assert.equal(after.id, f.event.id)
    assert.equal(after.revision, f.event.revision + 1)
    assert.equal(after.date, "2028-02-29")
    assert.equal(after.startTime, "20:00")
    assert.equal(after.endTime, "21:00")
    for (const field of [
      "title",
      "memo",
      "location",
      "participantIds",
      "createdByMemberId",
    ] as const)
      assert.deepEqual(after[field], f.event[field])
    assert.equal(
      (await f.legacy<unknown[]>(f.b, "GET", "calendar/events")).length,
      1
    )
    const replay = await f.call(
      f.a,
      "POST",
      `coordinations/${room.id}/apply`,
      body
    )
    assert.equal(replay.status, "applied")
    assert.equal((await f.getEvent()).revision, after.revision)
    const reopened = createCoordinationService({ db: f.db })
    assert.equal(
      (
        (await reopened.request(
          f.b,
          "GET",
          `coordinations/${room.id}`
        )) as CoordinationRoom
      ).resultEventRevision,
      after.revision
    )
    await rejected(
      () =>
        f.call(f.a, "POST", `coordinations/${room.id}/apply`, {
          ...body,
          expectedRevision: applied.revision,
        }),
      409
    )
  } finally {
    f.close()
  }
})

test("nonparties cannot discover a room and only the event creator can create or apply it", async () => {
  const f = await fixture()
  try {
    for (const who of [f.c, f.outsider]) {
      assert.deepEqual(await f.call(who, "GET", "coordinations"), [])
      await rejected(
        () => f.call(who, "GET", `coordinations/${f.room.id}`),
        404
      )
      await rejected(
        () =>
          f.mutate(who, f.room, "contributions", { text: "권한 없는 참여" }),
        404
      )
    }
    await rejected(
      () =>
        f.call(f.b, "POST", "coordinations", {
          eventId: f.event.id,
          expectedEventRevision: f.event.revision,
          requestId: key(),
        }),
      403
    )
    const room = await approved(f)
    await rejected(() => f.mutate(f.b, room, "apply"), 403)
    assert.equal((await f.getEvent()).revision, f.event.revision)
  } finally {
    f.close()
  }
})

test("old revisions and incomplete consent cannot change a calendar; edits reset all decisions", async () => {
  const f = await fixture()
  try {
    let room = await f.mutate(f.a, f.room, "proposals", { proposal })
    await rejected(() => f.mutate(f.a, room, "apply"), 409)
    room = await f.mutate(f.a, room, "decisions", { decision: "accept" })
    await rejected(() => f.mutate(f.a, room, "apply"), 409)
    await rejected(
      () => f.mutate(f.b, f.room, "decisions", { decision: "accept" }),
      409
    )
    const oldDigest = room.proposal?.digest
    room = await f.mutate(f.b, room, "proposals", {
      proposal: {
        ...proposal,
        summary: "다시 확인할 수정 제안",
        startTime: "20:30",
      },
    })
    assert.notEqual(room.proposal?.digest, oldDigest)
    assert.equal(room.decisions.length, 0)
    room = await f.mutate(f.a, room, "decisions", { decision: "accept" })
    room = await f.mutate(f.b, room, "contributions", {
      text: "조건을 바꿔 다시 이야기해요",
    })
    assert.equal(room.status, "open")
    assert.equal(room.proposal, null)
    assert.deepEqual(room.decisions, [])
    await rejected(() => f.mutate(f.a, room, "apply"), 409)
    assert.equal((await f.getEvent()).revision, f.event.revision)
  } finally {
    f.close()
  }
})

test("defer blocks execution, decline is terminal and withdrawal removes consent without rolling back applied events", async () => {
  for (const decision of ["defer", "decline"] as const) {
    const f = await fixture()
    try {
      let room = await approved(f)
      room = await f.mutate(f.b, room, "decisions", { decision })
      assert.equal(room.status, decision === "defer" ? "deferred" : "declined")
      await rejected(() => f.mutate(f.a, room, "apply"), 409)
      if (decision === "decline")
        await rejected(
          () => f.mutate(f.a, room, "proposals", { proposal }),
          409
        )
      else {
        room = await f.mutate(f.b, room, "decisions", { decision: "accept" })
        assert.equal(room.status, "proposed")
      }
      room = await f.mutate(f.b, room, "withdraw")
      assert.equal(room.status, "withdrawn")
      assert.equal(
        room.contributions.some((c) => c.actorId === f.b.id),
        false
      )
      assert.equal(room.proposal, null)
      assert.equal(room.decisions.length, 0)
      await rejected(() => f.mutate(f.a, room, "apply"), 409)
    } finally {
      f.close()
    }
  }
  const f = await fixture()
  try {
    const room = await approved(f)
    const applied = await f.mutate(f.a, room, "apply")
    await f.mutate(f.b, applied, "withdraw")
    assert.equal((await f.getEvent()).startTime, "20:00")
  } finally {
    f.close()
  }
})

test("calendar edits, membership loss and room expiry invalidate consent before execution", async () => {
  for (const invalidation of ["event", "membership", "expiry"] as const) {
    const f = await fixture()
    try {
      const room = await approved(f)
      if (invalidation === "event") {
        await f.legacy(f.a, "PATCH", `calendar/events/${f.event.id}`, {
          fields: { ...fields([f.a.id, f.b.id]), memo: "외부 변경" },
          expectedRevision: f.event.revision,
          requestId: key(),
        })
      } else if (invalidation === "membership") {
        f.db.prepare("DELETE FROM v2_members WHERE user_id=?").run(f.b.id)
      } else {
        const row = f.db
          .prepare("SELECT payload FROM v2_records WHERE id=?")
          .get(room.id) as { payload: string }
        f.db
          .prepare("UPDATE v2_records SET payload=? WHERE id=?")
          .run(
            JSON.stringify({
              ...JSON.parse(row.payload),
              expiresAt: "2000-01-01T00:00:00Z",
            }),
            room.id
          )
      }
      await assert.rejects(() => f.mutate(f.a, room, "apply"))
      assert.equal((await f.getEvent()).startTime, "19:00")
      if (invalidation === "expiry") {
        await rejected(
          () => f.mutate(f.a, room, "decisions", { decision: "accept" }),
          409
        )
        const withdrawn = await f.mutate(f.a, room, "withdraw")
        assert.equal(withdrawn.status, "withdrawn")
      }
    } finally {
      f.close()
    }
  }
})

test("invalid dates and replay payloads fail, concurrent requests admit exactly one new revision", async () => {
  const f = await fixture()
  try {
    const requestId = key()
    await rejected(
      () =>
        f.mutate(f.a, f.room, "proposals", {
          proposal: { ...proposal, date: "2027-02-29" },
          requestId,
        }),
      422
    )
    assert.equal(
      f.db
        .prepare("SELECT count(*) n FROM v2_receipts WHERE request_id=?")
        .get(requestId)?.n,
      0
    )
    for (const invalid of [
      { endTime: "19:00" },
      { startTime: "25:00" },
      { date: "2028-04-31" },
    ])
      await rejected(
        () =>
          f.mutate(f.a, f.room, "proposals", {
            proposal: { ...proposal, ...invalid },
          }),
        422
      )
    const body = { expectedRevision: f.room.revision, requestId, proposal }
    const duplicates = await Promise.all([
      f.call(f.a, "POST", `coordinations/${f.room.id}/proposals`, body),
      f.call(f.a, "POST", `coordinations/${f.room.id}/proposals`, body),
    ])
    assert.equal(duplicates[0].revision, duplicates[1].revision)
    await rejected(
      () =>
        f.call(f.a, "POST", `coordinations/${f.room.id}/proposals`, {
          ...body,
          proposal: { ...proposal, summary: "키 재사용 공격" },
        }),
      409
    )
    const room = duplicates[0]
    const competing = await Promise.allSettled([
      f.mutate(f.a, room, "decisions", { decision: "accept" }),
      f.mutate(f.b, room, "decisions", { decision: "accept" }),
    ])
    assert.equal(
      competing.filter((result) => result.status === "fulfilled").length,
      1
    )
    const failed = competing.find((result) => result.status === "rejected")
    assert.equal(failed?.status === "rejected" && failed.reason.status, 409)
  } finally {
    f.close()
  }
})

test("calendar and room rollback if writing the atomic idempotency receipt fails", async () => {
  const f = await fixture()
  try {
    const room = await approved(f)
    f.db.exec(
      "CREATE TRIGGER qa_receipt_failure BEFORE INSERT ON v2_receipts BEGIN SELECT RAISE(ABORT, 'synthetic receipt failure'); END"
    )
    await assert.rejects(() => f.mutate(f.a, room, "apply"))
    assert.equal((await f.getEvent()).revision, f.event.revision)
    assert.equal(
      (await f.call(f.b, "GET", `coordinations/${room.id}`)).status,
      "proposed"
    )
    f.db.exec("DROP TRIGGER qa_receipt_failure")
    assert.equal((await f.mutate(f.a, room, "apply")).status, "applied")
  } finally {
    f.close()
  }
})

test("AI sees approved room contributions only; preview is transient and explicit timezone conversion is stable", async () => {
  let captured: JointContext | undefined
  const f = await fixture(async (context) => {
    captured = context
    return generated(context)
  })
  try {
    await f.legacy(f.a, "POST", "mind/messages", {
      text: "UNRELATED_PRIVATE_MESSAGE",
      recipientMemberId: f.c.id,
      requestId: key(),
    })
    const room = await f.mutate(f.a, f.room, "contributions", {
      text: "20시에 식사를 시작하고 싶어요",
    })
    const preview = await f.call<CoordinationPreview>(
      f.a,
      "POST",
      `coordinations/${room.id}/suggestions`,
      { expectedRevision: room.revision }
    )
    assert.ok(captured)
    assert.equal(captured.scope.actorId, f.a.id)
    assert.equal(captured.scope.timezone, "Asia/Seoul")
    assert.equal(captured.cards.length, 1)
    assert.equal(captured.cards[0].senderId, f.a.id)
    assert.equal(captured.cards[0].exactText, "20시에 식사를 시작하고 싶어요")
    assert.deepEqual(captured.cards[0].recipients, [f.b.id])
    assert.equal(
      JSON.stringify(captured).includes("UNRELATED_PRIVATE_MESSAGE"),
      false
    )
    assert.equal(captured.schedules[0].start, "2028-02-29T19:00:00+09:00")
    assert.equal(preview.date, "2028-02-29")
    assert.equal(preview.startTime, "20:00")
    assert.equal(preview.endTime, "21:00")
    assert.deepEqual(preview.unsupportedReasons, [])
    for (const table of ["v2_records", "v2_receipts"])
      assert.equal(
        JSON.stringify(f.db.prepare(`SELECT * FROM ${table}`).all()).includes(
          "UNSAVED_AI_PREVIEW"
        ),
        false
      )
    assert.equal(
      (await f.call(f.a, "GET", `coordinations/${room.id}`)).revision,
      room.revision
    )
    assert.equal((await f.getEvent()).startTime, "19:00")
  } finally {
    f.close()
  }
})

test("AI result becomes stale if a contribution changes while the model is pending", async () => {
  let resolveModel!: (draft: AgreementDraft) => void
  let entered!: () => void
  let captured!: JointContext
  const started = new Promise<void>((resolve) => {
    entered = resolve
  })
  const f = await fixture(async (context) => {
    captured = context
    entered()
    return new Promise<AgreementDraft>((resolve) => {
      resolveModel = resolve
    })
  })
  try {
    const room = await f.mutate(f.a, f.room, "contributions", {
      text: "기존 공유 조건",
    })
    const waiting = f.call(
      f.a,
      "POST",
      `coordinations/${room.id}/suggestions`,
      { expectedRevision: room.revision }
    )
    const rejection = rejected(() => waiting, 409)
    await started
    await f.mutate(f.b, room, "contributions", { text: "새로 공유한 조건" })
    resolveModel(generated(captured))
    await rejection
    assert.equal(
      JSON.stringify(f.db.prepare("SELECT * FROM v2_records").all()).includes(
        "UNSAVED_AI_PREVIEW"
      ),
      false
    )
  } finally {
    f.close()
  }
})

test("unsupported AI action details remain visible blockers and unavailable AI preserves manual flow", async () => {
  const f = await fixture(async (context) => {
    const draft = generated(context)
    draft.actions[0].recurrence = "weekly"
    draft.actions[0].weekdays = [2]
    draft.actions[0].until = "2028-04-01T00:00:00Z"
    draft.actions[0].reminderRecipients = [context.scope.actorId]
    draft.actions[0].reminderAt = "2028-02-29T10:00:00Z"
    draft.actions[0].maxReminders = 1
    return draft
  })
  try {
    const room = await f.mutate(f.a, f.room, "contributions", {
      text: "반복 여부도 검토해요",
    })
    const preview = await f.call<CoordinationPreview>(
      f.a,
      "POST",
      `coordinations/${room.id}/suggestions`,
      { expectedRevision: room.revision }
    )
    assert.ok(preview.unsupportedReasons.length > 0)
    assert.equal(
      (await f.call(f.a, "GET", `coordinations/${room.id}`)).proposal,
      null
    )
    assert.equal((await f.getEvent()).startTime, "19:00")
  } finally {
    f.close()
  }
  const manual = await fixture()
  try {
    const room = await manual.mutate(manual.a, manual.room, "contributions", {
      text: "직접 제안해요",
    })
    await rejected(
      () =>
        manual.call(manual.a, "POST", `coordinations/${room.id}/suggestions`, {
          expectedRevision: room.revision,
        }),
      503
    )
    assert.equal(
      (await manual.mutate(manual.a, room, "proposals", { proposal })).status,
      "proposed"
    )
  } finally {
    manual.close()
  }
})

test("idempotent retries return current room without resurrecting a withdrawn contribution", async () => {
  const f = await fixture()
  try {
    const unique = `WITHDRAWN_CONTRIBUTION_${key()}`
    const requestId = key(),
      body = { text: unique, expectedRevision: f.room.revision, requestId }
    const shared = await f.call(
      f.a,
      "POST",
      `coordinations/${f.room.id}/contributions`,
      body
    )
    const withdrawn = await f.mutate(f.a, shared, "withdraw")
    assert.equal(withdrawn.status, "withdrawn")
    const replay = await f.call(
      f.a,
      "POST",
      `coordinations/${f.room.id}/contributions`,
      body
    )
    assert.equal(replay.status, "withdrawn")
    assert.equal(JSON.stringify(replay).includes(unique), false)
    assert.equal(
      JSON.stringify(f.db.prepare("SELECT * FROM v2_receipts").all()).includes(
        unique
      ),
      false
    )
  } finally {
    f.close()
  }
})
