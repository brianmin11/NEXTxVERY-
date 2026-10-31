import { createHash, randomUUID } from "node:crypto"
import type { DatabaseSync } from "node:sqlite"
import { z } from "zod"
import { AgreementDraft, type JointContext } from "@family-os/relationship-ai"
import { isValidDateKey, isValidTimeKey } from "../../../lib/calendar/date"
import type { CalendarEvent } from "../../../lib/calendar/types"
import type {
  CoordinationPreview,
  CoordinationProposal,
  CoordinationRoom,
} from "../../contracts/coordination"
import { V2Error, type V2Actor } from "./v2-service"

type Options = {
  db: DatabaseSync
  propose?: (context: JointContext) => Promise<AgreementDraft>
}
type RecordRow = {
  id: string
  kind: string
  family_id: string
  owner_id: string
  revision: number
  payload: string
}
type Member = { user_id: string; family_id: string }
const identifier = z.string().min(1).max(128)
const revision = z.number().int().positive()
const requestId = z.string().min(8).max(128)
const change = z.object({ expectedRevision: revision, requestId })
const proposalSchema = z
  .object({
    summary: z.string().trim().min(1).max(500),
    date: z.string().refine(isValidDateKey),
    startTime: z.string().refine(isValidTimeKey),
    endTime: z.string().refine(isValidTimeKey),
  })
  .refine((p) => p.endTime > p.startTime)
function fail(code: string, status: number, message: string): never {
  throw new V2Error(code, status, message)
}
function conflict(): never {
  return fail(
    "REVISION_CONFLICT",
    409,
    "내용이 변경됐어요. 최신 내용을 다시 확인해 주세요."
  )
}
function missing(): never {
  return fail("NOT_FOUND", 404, "조율 항목을 찾을 수 없어요.")
}
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success)
    fail("INPUT_INVALID", 422, "입력 내용과 날짜·시간을 확인해 주세요.")
  return result.data
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`
  return JSON.stringify(value) ?? "null"
}
function hash(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex")
}
const sorted = (items: string[]) => [...new Set(items)].sort()
const sameIds = (a: string[], b: string[]) =>
  canonical(sorted(a)) === canonical(sorted(b))
const iso = (date: string, time: string) => `${date}T${time}:00+09:00`

/** Only approved contributions and proposals are persisted. AI previews never enter receipts. */
export function createCoordinationService({ db, propose }: Options) {
  function member(actor: V2Actor): Member {
    const result = db
      .prepare("SELECT user_id,family_id FROM v2_members WHERE user_id=?")
      .get(actor.id) as Member | undefined
    if (!result) fail("FAMILY_REQUIRED", 403, "먼저 가족 공간에 참여해 주세요.")
    return result
  }
  function record(actor: V2Actor, id: string, kind: string): RecordRow {
    const membership = member(actor)
    const result = db
      .prepare("SELECT * FROM v2_records WHERE id=? AND kind=? AND family_id=?")
      .get(id, kind, membership.family_id) as RecordRow | undefined
    if (!result) missing()
    return result
  }
  function room(actor: V2Actor, id: string): CoordinationRoom {
    const row = record(actor, id, "coordination")
    const value: CoordinationRoom = {
      ...JSON.parse(row.payload),
      revision: row.revision,
    }
    if (!value.parties.includes(actor.id)) missing()
    return value
  }
  function event(actor: V2Actor, id: string) {
    const row = record(actor, id, "event")
    const value = {
      ...JSON.parse(row.payload),
      revision: row.revision,
    } as CalendarEvent & { revision: number }
    return { row, value }
  }
  function checkParties(familyId: string, parties: string[]) {
    const members = db
      .prepare("SELECT user_id FROM v2_members WHERE family_id=?")
      .all(familyId) as { user_id: string }[]
    const ids = new Set(members.map((m) => m.user_id))
    if (parties.some((id) => !ids.has(id)))
      fail(
        "CONTEXT_CHANGED",
        409,
        "가족 구성원이 변경됐어요. 새 조율을 시작해 주세요."
      )
  }
  function checkCurrent(actor: V2Actor, value: CoordinationRoom) {
    if (Date.parse(value.expiresAt) <= Date.now())
      fail(
        "COORDINATION_EXPIRED",
        409,
        "조율이 만료됐어요. 새 조율을 시작해 주세요."
      )
    const current = event(actor, value.event.id)
    if (current.value.revision !== value.event.revision) conflict()
    if (
      current.row.owner_id !== value.creatorId ||
      current.value.createdByMemberId !== value.creatorId ||
      current.value.allDay ||
      !sameIds(value.parties, [
        current.value.createdByMemberId,
        ...current.value.participantIds,
      ])
    )
      conflict()
    checkParties(value.familyId, value.parties)
    return current
  }
  function expected(value: CoordinationRoom, n: number) {
    if (value.revision !== n) conflict()
  }
  function editable(value: CoordinationRoom) {
    if (!["open", "proposed", "deferred"].includes(value.status))
      fail(
        "COORDINATION_CLOSED",
        409,
        "종료된 조율이에요. 새 조율을 시작해 주세요."
      )
  }
  function save(value: CoordinationRoom, previousRevision: number) {
    const result = db
      .prepare(
        "UPDATE v2_records SET revision=?,payload=? WHERE id=? AND kind='coordination' AND revision=?"
      )
      .run(value.revision, JSON.stringify(value), value.id, previousRevision)
    if (result.changes !== 1) conflict()
    return value
  }
  function mutation(
    actor: V2Actor,
    method: string,
    path: string,
    body: { requestId: string },
    execute: () => CoordinationRoom
  ): CoordinationRoom {
    const fingerprint = hash({ method, path, body })
    db.exec("BEGIN IMMEDIATE")
    try {
      const prior = db
        .prepare(
          "SELECT payload_hash,result FROM v2_receipts WHERE actor_id=? AND request_id=?"
        )
        .get(actor.id, body.requestId) as
        { payload_hash: string; result: string } | undefined
      if (prior) {
        if (prior.payload_hash !== fingerprint)
          fail(
            "IDEMPOTENCY_CONFLICT",
            409,
            "같은 요청 번호로 다른 내용을 저장할 수 없어요."
          )
        const reference = JSON.parse(prior.result) as {
          coordinationId?: string
        }
        if (!reference.coordinationId) conflict()
        // Recheck current access and return current state, never a withdrawn text snapshot.
        const result = room(actor, reference.coordinationId)
        db.exec("COMMIT")
        return result
      }
      const result = execute()
      db.prepare(
        "INSERT INTO v2_receipts(actor_id,request_id,payload_hash,result) VALUES(?,?,?,?)"
      ).run(
        actor.id,
        body.requestId,
        fingerprint,
        JSON.stringify({ coordinationId: result.id })
      )
      db.exec("COMMIT")
      return result
    } catch (error) {
      if (db.isTransaction) db.exec("ROLLBACK")
      throw error
    }
  }
  function jointContext(actor: V2Actor, value: CoordinationRoom): JointContext {
    const purpose = `coordination:${value.id}`
    return {
      scope: {
        schemaVersion: "1.0",
        actorId: actor.id,
        householdId: value.familyId,
        participantIds: value.parties,
        now: new Date().toISOString(),
        timezone: "Asia/Seoul",
        purpose,
        permissionEpoch: 1,
      },
      cards: value.contributions.map((contribution) => ({
        schemaVersion: "1.0",
        id: `${value.id}:${contribution.actorId}`,
        revision: contribution.revision,
        senderId: contribution.actorId,
        householdId: value.familyId,
        exactText: contribution.text,
        recipients: value.parties.filter((id) => id !== contribution.actorId),
        purpose,
        validUntil: value.expiresAt,
        state: "active",
        hostVerified: true,
        permissionEpoch: 1,
      })),
      schedules: [
        {
          id: value.event.id,
          revision: value.event.revision,
          title: value.event.title,
          participantIds: value.parties,
          start: iso(value.event.date, value.event.startTime),
          end: iso(value.event.date, value.event.endTime),
        },
      ],
    }
  }
  function preview(
    raw: AgreementDraft,
    value: CoordinationRoom
  ): CoordinationPreview {
    const result = AgreementDraft.safeParse(raw)
    if (!result.success)
      fail(
        "AI_INVALID_RESPONSE",
        503,
        "제안을 정리하지 못했어요. 직접 내용을 작성해 주세요."
      )
    const draft = result.data
    const unsupportedReasons: string[] = []
    if (draft.status !== "draft" || !sameIds(draft.parties, value.parties))
      unsupportedReasons.push("조율 참여자 또는 제안 상태를 확인해야 해요.")
    if (draft.unknowns.length)
      unsupportedReasons.push(
        "아직 확인되지 않은 조건이 있어요: " + draft.unknowns.join(" · ")
      )
    if (draft.actions.length !== 1)
      unsupportedReasons.push("한 번에 하나의 기존 일정만 변경할 수 있어요.")
    const action = draft.actions[0]
    let date = "",
      startTime = "",
      endTime = ""
    if (
      !action ||
      action.kind !== "schedule_update" ||
      action.targetId !== value.event.id
    ) {
      unsupportedReasons.push(
        "이 일정의 시간 변경으로 표현할 수 없는 제안이에요."
      )
    } else {
      if (
        action.assigneeId ||
        action.deadline ||
        action.reminderAt ||
        action.reminderRecipients.length ||
        action.maxReminders
      )
        unsupportedReasons.push(
          "담당자·마감·알림 변경은 이 조율에서 반영할 수 없어요."
        )
      if (
        (action.recurrence && action.recurrence !== "none") ||
        action.weekdays.length ||
        action.until
      )
        unsupportedReasons.push("반복 일정은 이 조율에서 반영할 수 없어요.")
      if (action.preparation || action.followup || action.exception)
        unsupportedReasons.push("준비·후속·예외 조건을 별도로 확인해야 해요.")
      if (action.unresolvedFields.length)
        unsupportedReasons.push(
          "확인이 필요한 항목: " + action.unresolvedFields.join(" · ")
        )
      if (action.start && action.end) {
        // Date is explicitly Asia/Seoul, independent of the server's local timezone.
        const start = new Date(
          Date.parse(action.start) + 9 * 60 * 60 * 1000
        ).toISOString()
        const end = new Date(
          Date.parse(action.end) + 9 * 60 * 60 * 1000
        ).toISOString()
        if (
          start.slice(0, 10) !== end.slice(0, 10) ||
          start >= end ||
          start.slice(17) !== "00.000Z" ||
          end.slice(17) !== "00.000Z"
        ) {
          unsupportedReasons.push(
            "하루 안의 분 단위 시작·종료 시각을 확인해 주세요."
          )
        } else {
          date = start.slice(0, 10)
          startTime = start.slice(11, 16)
          endTime = end.slice(11, 16)
        }
      } else unsupportedReasons.push("시작·종료 시각이 정해지지 않았어요.")
    }
    if (draft.summary.length > 500)
      unsupportedReasons.push("공유할 요약을 500자 이내로 정리해 주세요.")
    return {
      summary: draft.summary,
      date,
      startTime,
      endTime,
      unsupportedReasons,
    }
  }

  async function request(
    actor: V2Actor,
    method: string,
    rawPath: string,
    body?: unknown
  ): Promise<unknown> {
    if (!actor?.id) fail("UNAUTHENTICATED", 401, "로그인이 필요해요.")
    const path = rawPath.replace(/^\/+|\/+$/g, "")
    if (path === "coordinations") {
      if (method === "GET") {
        const membership = member(actor)
        return (
          db
            .prepare(
              "SELECT * FROM v2_records WHERE kind='coordination' AND family_id=? ORDER BY id"
            )
            .all(membership.family_id) as RecordRow[]
        )
          .map(
            (r) =>
              ({
                ...JSON.parse(r.payload),
                revision: r.revision,
              }) as CoordinationRoom
          )
          .filter((r) => r.parties.includes(actor.id))
      }
      if (method === "POST") {
        const b = parse(
          z.object({
            eventId: identifier,
            expectedEventRevision: revision,
            requestId,
          }),
          body
        )
        return mutation(actor, method, path, b, () => {
          const { row, value: current } = event(actor, b.eventId)
          if (
            current.createdByMemberId !== actor.id ||
            row.owner_id !== actor.id
          )
            fail(
              "FORBIDDEN",
              403,
              "일정을 만든 사람만 조율을 시작할 수 있어요."
            )
          if (current.revision !== b.expectedEventRevision) conflict()
          const parties = sorted([
            current.createdByMemberId,
            ...current.participantIds,
          ])
          if (
            current.allDay ||
            !current.startTime ||
            !current.endTime ||
            parties.length < 2 ||
            parties.length > 20
          )
            fail(
              "INPUT_INVALID",
              422,
              "두 명 이상 참여하는 시간 지정 일정을 선택해 주세요."
            )
          checkParties(row.family_id, parties)
          const createdAt = new Date().toISOString()
          const result: CoordinationRoom = {
            id: randomUUID(),
            revision: 1,
            familyId: row.family_id,
            creatorId: actor.id,
            parties,
            event: {
              id: current.id,
              revision: current.revision,
              title: current.title,
              date: current.date,
              startTime: current.startTime,
              endTime: current.endTime,
            },
            status: "open",
            contributions: [],
            proposal: null,
            decisions: [],
            createdAt,
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
          }
          db.prepare(
            "INSERT INTO v2_records(id,kind,family_id,owner_id,revision,payload) VALUES(?,'coordination',?,?,?,?)"
          ).run(
            result.id,
            result.familyId,
            actor.id,
            result.revision,
            JSON.stringify(result)
          )
          return result
        })
      }
    }
    const match = path.match(
      /^coordinations\/([^/]+)(?:\/(contributions|suggestions|proposals|decisions|apply|withdraw))?$/
    )
    if (!match) missing()
    const [, objectId, action] = match
    if (method === "GET" && !action) return room(actor, objectId)
    if (method !== "POST" || !action) missing()
    if (action === "suggestions") {
      const b = parse(z.object({ expectedRevision: revision }), body)
      const value = room(actor, objectId)
      expected(value, b.expectedRevision)
      editable(value)
      checkCurrent(actor, value)
      if (!value.contributions.length)
        fail("INPUT_INVALID", 422, "먼저 함께 볼 의견을 공유해 주세요.")
      if (!propose)
        fail(
          "AI_UNAVAILABLE",
          503,
          "AI 제안을 이용할 수 없어요. 직접 제안을 작성할 수 있어요."
        )
      let generated: AgreementDraft
      try {
        generated = await propose(jointContext(actor, value))
      } catch (error) {
        if (error instanceof V2Error) throw error
        const code = (error as { code?: unknown } | null)?.code
        if (code === "BUDGET_EXCEEDED" || code === "AI_BUDGET_EXCEEDED")
          fail(
            "AI_BUDGET_EXCEEDED",
            503,
            "AI 이용 한도에 도달했어요. 직접 제안을 작성할 수 있어요."
          )
        fail(
          "AI_UNAVAILABLE",
          503,
          "AI 제안을 완료하지 못했어요. 직접 제안을 작성하거나 다시 시도해 주세요."
        )
      }
      const latest = room(actor, objectId)
      expected(latest, b.expectedRevision)
      editable(latest)
      checkCurrent(actor, latest)
      return preview(generated, latest)
    }
    if (action === "contributions") {
      const b = parse(
        change.extend({ text: z.string().trim().min(1).max(500) }),
        body
      )
      return mutation(actor, method, path, b, () => {
        const value = room(actor, objectId)
        expected(value, b.expectedRevision)
        editable(value)
        checkCurrent(actor, value)
        const prior = value.contributions.find(
          (item) => item.actorId === actor.id
        )
        value.contributions = value.contributions.filter(
          (item) => item.actorId !== actor.id
        )
        value.contributions.push({
          actorId: actor.id,
          text: b.text,
          revision: (prior?.revision ?? 0) + 1,
        })
        value.proposal = null
        value.decisions = []
        value.status = "open"
        value.revision++
        return save(value, b.expectedRevision)
      })
    }
    if (action === "proposals") {
      const b = parse(change.extend({ proposal: proposalSchema }), body)
      return mutation(actor, method, path, b, () => {
        const value = room(actor, objectId)
        expected(value, b.expectedRevision)
        editable(value)
        checkCurrent(actor, value)
        const version =
          Math.max(value.revision, value.proposal?.version ?? 0) + 1
        value.proposal = {
          ...b.proposal,
          version,
          digest: hash({
            roomId: value.id,
            event: value.event,
            parties: value.parties,
            proposal: b.proposal,
            version,
          }),
        }
        value.decisions = []
        value.status = "proposed"
        value.revision++
        return save(value, b.expectedRevision)
      })
    }
    if (action === "decisions") {
      const b = parse(
        change.extend({ decision: z.enum(["accept", "defer", "decline"]) }),
        body
      )
      return mutation(actor, method, path, b, () => {
        const value = room(actor, objectId)
        expected(value, b.expectedRevision)
        checkCurrent(actor, value)
        if (!["proposed", "deferred"].includes(value.status) || !value.proposal)
          fail("PROPOSAL_REQUIRED", 409, "먼저 공유된 제안을 확인해 주세요.")
        value.decisions = value.decisions.filter(
          (item) => item.actorId !== actor.id
        )
        value.decisions.push({
          actorId: actor.id,
          decision: b.decision,
          digest: value.proposal.digest,
        })
        value.status =
          b.decision === "decline"
            ? "declined"
            : value.decisions.some((item) => item.decision === "defer")
              ? "deferred"
              : "proposed"
        value.revision++
        return save(value, b.expectedRevision)
      })
    }
    if (action === "apply") {
      const b = parse(change, body)
      return mutation(actor, method, path, b, () => {
        const value = room(actor, objectId)
        if (actor.id !== value.creatorId)
          fail(
            "FORBIDDEN",
            403,
            "일정을 만든 사람만 합의 내용을 반영할 수 있어요."
          )
        expected(value, b.expectedRevision)
        const current = checkCurrent(actor, value)
        const proposal = value.proposal
        if (
          value.status !== "proposed" ||
          !proposal ||
          !value.parties.every((id) =>
            value.decisions.some(
              (item) =>
                item.actorId === id &&
                item.decision === "accept" &&
                item.digest === proposal.digest
            )
          )
        )
          fail(
            "ACCEPTANCE_REQUIRED",
            409,
            "모든 참여자가 같은 제안을 수락해야 일정에 반영할 수 있어요."
          )
        const fields: CoordinationProposal = parse(proposalSchema, proposal)
        const updated = {
          ...current.value,
          date: fields.date,
          startTime: fields.startTime,
          endTime: fields.endTime,
          revision: current.value.revision + 1,
        }
        const result = db
          .prepare(
            "UPDATE v2_records SET revision=?,payload=? WHERE id=? AND kind='event' AND revision=? AND family_id=? AND owner_id=?"
          )
          .run(
            updated.revision,
            JSON.stringify(updated),
            updated.id,
            value.event.revision,
            value.familyId,
            value.creatorId
          )
        if (result.changes !== 1) conflict()
        value.status = "applied"
        value.resultEventRevision = updated.revision
        value.revision++
        return save(value, b.expectedRevision)
      })
    }
    if (action === "withdraw") {
      const b = parse(change, body)
      return mutation(actor, method, path, b, () => {
        const value = room(actor, objectId)
        expected(value, b.expectedRevision)
        value.contributions = value.contributions.filter(
          (item) => item.actorId !== actor.id
        )
        value.proposal = null
        value.decisions = []
        value.status = "withdrawn"
        value.revision++
        return save(value, b.expectedRevision)
      })
    }
    return missing()
  }
  return { request }
}
