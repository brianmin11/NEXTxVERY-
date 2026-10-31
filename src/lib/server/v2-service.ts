import { createHash, createHmac, randomUUID } from "node:crypto"
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import type { DatabaseSync } from "node:sqlite"
import sharp from "sharp"
import { z } from "zod"
import { isValidDateKey, isValidTimeKey } from "../../../lib/calendar/date"
import type { CalendarEvent } from "../../../lib/calendar/types"
import type { Chore } from "../../../lib/chores/types"
import type { MindMessage } from "../../../lib/mind/types"
import type { MemoryPost } from "../../../lib/memories/types"

export type V2Actor = { id: string; name: string; email?: string }
export class V2Error extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string
  ) {
    super(message)
    this.name = "V2Error"
  }
}
function fail(code: string, status: number, message: string): never {
  throw new V2Error(code, status, message)
}
const missing = (): never => fail("NOT_FOUND", 404, "항목을 찾을 수 없어요.")
const denied = (): never =>
  fail("FORBIDDEN", 403, "이 작업을 할 권한이 없어요.")
const conflict = (): never =>
  fail(
    "REVISION_CONFLICT",
    409,
    "내용이 변경됐어요. 새로고침한 뒤 다시 확인해 주세요."
  )
const id = z.string().min(1).max(128)
const requestId = z.string().min(8).max(128)
const revision = z.number().int().positive()
const date = z.string().refine(isValidDateKey)
const text = (max: number) => z.string().trim().min(1).max(max)
const calendarFields = z
  .object({
    title: text(40),
    category: z.enum(["meal", "dining-out", "trip", "other"]),
    date,
    allDay: z.boolean(),
    startTime: z.string().nullable(),
    endTime: z.string().nullable(),
    location: z.string().max(40),
    memo: z.string().max(200),
    participantIds: z.array(id).max(100),
  })
  .strip()
  .superRefine((v, ctx) => {
    if (v.allDay) {
      if (v.startTime !== null || v.endTime !== null)
        ctx.addIssue({
          code: "custom",
          message: "종일 일정에는 시간을 지정할 수 없어요.",
        })
    } else if (
      !v.startTime ||
      !v.endTime ||
      !isValidTimeKey(v.startTime) ||
      !isValidTimeKey(v.endTime) ||
      v.endTime <= v.startTime
    )
      ctx.addIssue({
        code: "custom",
        message: "시작·종료 시간을 확인해 주세요.",
      })
  })
const choreFields = z
  .object({
    title: text(40),
    memo: z.string().max(200),
    assigneeMemberId: id,
    dueDate: date.nullable(),
  })
  .strip()
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value)
  if (!r.success)
    fail("INPUT_INVALID", 422, "입력 항목과 날짜를 확인해 주세요.")
  return r.data
}
function hash(value: string) {
  return createHash("sha256").update(value).digest("hex")
}
function canonical(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]"
  if (v && typeof v === "object")
    return (
      "{" +
      Object.entries(v)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, x]) => JSON.stringify(k) + ":" + canonical(x))
        .join(",") +
      "}"
    )
  return JSON.stringify(v) ?? "null"
}
type Row = {
  id: string
  kind: string
  family_id: string
  owner_id: string
  revision: number
  payload: string
}
type Membership = { user_id: string; family_id: string; name: string }
type Versioned<T> = T & { revision: number }
export type RemoteAsset = {
  id: string
  kind: "remote"
  url: string
  mime: string
  width: number
  height: number
  bytes: number
}
type Asset = RemoteAsset & {
  state: "pending" | "attached" | "deleting"
  createdAt: string
  file: string
}
type Options = {
  inviteSecret?: string
  db: DatabaseSync
  uploadDir?: string
  suggest?: (
    rawText: string,
    recipientName: string,
    context: { actorId: string; recipientId: string; familyId: string }
  ) => Promise<string>
}

export function createV2Service({
  db,
  uploadDir = resolve(".data/uploads"),
  suggest,
  inviteSecret,
}: Options) {
  function transaction<T>(fn: () => T): T {
    db.exec("BEGIN IMMEDIATE")
    try {
      const result = fn()
      db.exec("COMMIT")
      return result
    } catch (e) {
      db.exec("ROLLBACK")
      throw e
    }
  }
  function member(actor: V2Actor): Membership {
    const m = db
      .prepare("SELECT * FROM v2_members WHERE user_id=?")
      .get(actor.id) as Membership | undefined
    if (!m) fail("FAMILY_REQUIRED", 403, "먼저 가족 공간에 참여해 주세요.")
    return m
  }
  function members(familyId: string) {
    return db
      .prepare("SELECT * FROM v2_members WHERE family_id=? ORDER BY user_id")
      .all(familyId) as Membership[]
  }
  function checkMembers(familyId: string, ids: string[]) {
    const allowed = new Set(members(familyId).map((m) => m.user_id))
    if (ids.some((x) => !allowed.has(x)) || new Set(ids).size !== ids.length)
      fail("INPUT_INVALID", 422, "같은 가족의 구성원을 선택해 주세요.")
  }
  function session(actor: V2Actor) {
    const m = db
      .prepare("SELECT * FROM v2_members WHERE user_id=?")
      .get(actor.id) as Membership | undefined
    const family = m
      ? (db.prepare("SELECT * FROM v2_families WHERE id=?").get(m.family_id) as
          { id: string; name: string } | undefined)
      : undefined
    return {
      viewer: { id: actor.id, name: actor.name },
      family: family
        ? {
            ...family,
            houseStage: 1,
            members: members(family.id).map((x) => ({
              id: x.user_id,
              name: x.name,
              tone: "sage" as const,
              avatar: { face: "smile" as const, accessory: "none" as const },
            })),
          }
        : null,
    }
  }
  function row(actor: V2Actor, kind: string, objectId: string): Row {
    const m = member(actor),
      r = db
        .prepare(
          "SELECT * FROM v2_records WHERE id=? AND kind=? AND family_id=?"
        )
        .get(objectId, kind, m.family_id) as Row | undefined
    if (!r) return missing()
    return r
  }
  function decode<T>(r: Row): Versioned<T> {
    return { ...JSON.parse(r.payload), revision: r.revision }
  }
  function list<T>(actor: V2Actor, kind: string): Versioned<T>[] {
    const m = member(actor)
    return (
      db
        .prepare(
          "SELECT * FROM v2_records WHERE family_id=? AND kind=? ORDER BY id"
        )
        .all(m.family_id, kind) as Row[]
    ).map((r) => decode<T>(r))
  }
  function put<T extends { id: string; revision: number }>(
    kind: string,
    familyId: string,
    ownerId: string,
    value: T
  ) {
    db.prepare(
      "INSERT INTO v2_records(id,kind,family_id,owner_id,revision,payload) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload"
    ).run(
      value.id,
      kind,
      familyId,
      ownerId,
      value.revision,
      JSON.stringify(value)
    )
    return value
  }
  function requireRevision(r: Row, value: number) {
    if (r.revision !== value) conflict()
  }
  function mutate<T>(
    actor: V2Actor,
    method: string,
    path: string,
    body: unknown,
    fn: () => T
  ): T {
    const token = parse(z.object({ requestId }), body).requestId
    const payloadHash = hash(canonical({ method, path, body }))
    return transaction(() => {
      const old = db
        .prepare(
          "SELECT payload_hash,result FROM v2_receipts WHERE actor_id=? AND request_id=?"
        )
        .get(actor.id, token) as
        { payload_hash: string; result: string } | undefined
      if (old) {
        if (old.payload_hash !== payloadHash)
          fail(
            "IDEMPOTENCY_CONFLICT",
            409,
            "같은 요청 번호로 다른 내용을 저장할 수 없어요."
          )
        return JSON.parse(old.result) as T
      }
      const result = fn()
      db.prepare(
        "INSERT INTO v2_receipts(actor_id,request_id,payload_hash,result) VALUES(?,?,?,?)"
      ).run(actor.id, token, payloadHash, JSON.stringify(result))
      return result
    })
  }
  function message(actor: V2Actor, objectId: string) {
    const r = row(actor, "message", objectId),
      v = decode<MindMessage>(r)
    if (v.fromId !== actor.id && v.toId !== actor.id) missing()
    return { r, v }
  }
  function remote(a: Asset): RemoteAsset {
    return {
      id: a.id,
      kind: "remote",
      url: `/api/v2/memories/assets/${a.id}/content`,
      mime: a.mime,
      width: a.width,
      height: a.height,
      bytes: a.bytes,
    }
  }
  function asset(actor: V2Actor, objectId: string) {
    const r = row(actor, "asset", objectId),
      v = decode<Asset>(r)
    if (
      v.state === "deleting" ||
      (v.state === "pending" &&
        (r.owner_id !== actor.id ||
          Date.parse(v.createdAt) < Date.now() - 86400000))
    )
      missing()
    return { r, v }
  }

  async function request(
    actor: V2Actor,
    method: string,
    path: string,
    body?: unknown
  ): Promise<unknown> {
    if (!actor?.id) fail("UNAUTHENTICATED", 401, "로그인이 필요해요.")
    path = path.replace(/^\/+|\/+$/g, "")
    if (method === "GET" && path === "session") return session(actor)
    if (method === "POST" && path === "families") {
      const b = parse(z.object({ name: text(80), requestId }), body)
      return mutate(actor, method, path, b, () => {
        if (
          db
            .prepare("SELECT user_id FROM v2_members WHERE user_id=?")
            .get(actor.id)
        )
          fail("ALREADY_JOINED", 409, "이미 가족에 참여하고 있어요.")
        const familyId = randomUUID()
        db.prepare("INSERT INTO v2_families(id,name) VALUES(?,?)").run(
          familyId,
          b.name
        )
        db.prepare(
          "INSERT INTO v2_members(user_id,family_id,name) VALUES(?,?,?)"
        ).run(actor.id, familyId, actor.name)
        return session(actor)
      })
    }
    if (method === "POST" && path === "family/join") {
      const b = parse(
        z.object({ inviteCode: z.string().min(16).max(128), requestId }),
        body
      )
      return mutate(actor, method, path, b, () => {
        if (
          db
            .prepare("SELECT user_id FROM v2_members WHERE user_id=?")
            .get(actor.id)
        )
          fail("ALREADY_JOINED", 409, "이미 가족에 참여하고 있어요.")
        const invite = db
          .prepare(
            "SELECT family_id,expires_at FROM v2_invites WHERE code_hash=?"
          )
          .get(hash(b.inviteCode)) as
          { family_id: string; expires_at: string } | undefined
        if (!invite || Date.parse(invite.expires_at) <= Date.now())
          fail("INVITE_INVALID", 422, "초대 코드가 없거나 만료됐어요.")
        db.prepare(
          "INSERT INTO v2_members(user_id,family_id,name) VALUES(?,?,?)"
        ).run(actor.id, invite.family_id, actor.name)
        return session(actor)
      })
    }
    const m = member(actor)
    if (method === "POST" && path === "family/invites") {
      const b = parse(z.object({ requestId }), body)
      if (!inviteSecret || inviteSecret.length < 32)
        fail("INVITE_UNAVAILABLE", 503, "초대 설정을 확인해 주세요.")
      const inviteCode = createHmac("sha256", inviteSecret)
        .update(
          JSON.stringify(["v2-invite", actor.id, m.family_id, b.requestId])
        )
        .digest("base64url")
      mutate(actor, method, path, b, () => {
        db.prepare(
          "INSERT INTO v2_invites(code_hash,family_id,expires_at) VALUES(?,?,?)"
        ).run(
          hash(inviteCode),
          m.family_id,
          new Date(Date.now() + 86400000).toISOString()
        )
        return { created: true }
      })
      const storedInvite = db
        .prepare("SELECT expires_at FROM v2_invites WHERE code_hash=?")
        .get(hash(inviteCode)) as { expires_at: string } | undefined
      if (!storedInvite || Date.parse(storedInvite.expires_at) <= Date.now())
        fail("INVITE_EXPIRED", 409, "새 초대 코드를 만들어 주세요.")
      return { inviteCode }
    }
    if (path === "calendar/events") {
      if (method === "GET") return list<CalendarEvent>(actor, "event")
      if (method === "POST") {
        const b = parse(z.object({ fields: calendarFields, requestId }), body)
        return mutate(actor, method, path, b, () => {
          checkMembers(m.family_id, b.fields.participantIds)
          return put("event", m.family_id, actor.id, {
            ...b.fields,
            id: randomUUID(),
            revision: 1,
            createdByMemberId: actor.id,
          })
        })
      }
    }
    let match = path.match(/^calendar\/events\/([^/]+)$/)
    if (match) {
      const objectId = match[1]
      if (method === "GET")
        return decode<CalendarEvent>(row(actor, "event", objectId))
      if (method === "PATCH" || method === "DELETE") {
        const b = parse(
          method === "PATCH"
            ? z.object({
                fields: calendarFields,
                expectedRevision: revision,
                requestId,
              })
            : z.object({ expectedRevision: revision, requestId }),
          body
        )
        return mutate(actor, method, path, b, () => {
          const r = row(actor, "event", objectId)
          if (r.owner_id !== actor.id) denied()
          requireRevision(r, b.expectedRevision)
          if (method === "DELETE") {
            db.prepare("DELETE FROM v2_records WHERE id=?").run(r.id)
            return { id: r.id, deleted: true }
          }
          const fields = (
            b as unknown as { fields: z.infer<typeof calendarFields> }
          ).fields
          checkMembers(m.family_id, fields.participantIds)
          return put("event", m.family_id, actor.id, {
            ...decode<CalendarEvent>(r),
            ...fields,
            revision: r.revision + 1,
          })
        })
      }
    }
    if (path === "chores") {
      if (method === "GET") return list<Chore>(actor, "chore")
      if (method === "POST") {
        const b = parse(z.object({ fields: choreFields, requestId }), body)
        return mutate(actor, method, path, b, () => {
          checkMembers(m.family_id, [b.fields.assigneeMemberId])
          const now = new Date().toISOString()
          return put("chore", m.family_id, actor.id, {
            ...b.fields,
            id: randomUUID(),
            revision: 1,
            status: "todo",
            createdByMemberId: actor.id,
            createdAt: now,
            updatedAt: now,
            completedAt: null,
            completedByMemberId: null,
          })
        })
      }
    }
    match = path.match(/^chores\/([^/]+)(\/status)?$/)
    if (match) {
      const objectId = match[1]
      if (method === "GET" && !match[2])
        return decode<Chore>(row(actor, "chore", objectId))
      if (
        (method === "PUT" && match[2]) ||
        ((method === "PATCH" || method === "DELETE") && !match[2])
      ) {
        const common = { expectedRevision: revision, requestId }
        const b = parse(
          method === "PUT"
            ? z.object({ ...common, status: z.enum(["todo", "done"]) })
            : method === "PATCH"
              ? z.object({ ...common, fields: choreFields })
              : z.object(common),
          body
        )
        return mutate(actor, method, path, b, () => {
          const r = row(actor, "chore", objectId),
            v = decode<Chore>(r)
          if (method === "PUT") {
            if (r.owner_id !== actor.id && v.assigneeMemberId !== actor.id)
              denied()
          } else if (r.owner_id !== actor.id) denied()
          requireRevision(r, b.expectedRevision)
          if (method === "DELETE") {
            db.prepare("DELETE FROM v2_records WHERE id=?").run(r.id)
            return { id: r.id, deleted: true }
          }
          if (method === "PATCH") {
            if (v.status !== "todo")
              fail(
                "CHORE_COMPLETED",
                403,
                "완료한 할 일은 먼저 완료를 취소해 주세요."
              )
            const fields = (
              b as unknown as { fields: z.infer<typeof choreFields> }
            ).fields
            checkMembers(m.family_id, [fields.assigneeMemberId])
            return put("chore", m.family_id, r.owner_id, {
              ...v,
              ...fields,
              updatedAt: new Date().toISOString(),
              revision: r.revision + 1,
            })
          }
          const status = (b as unknown as { status: "todo" | "done" }).status
          if (v.status === status) return v
          const now = new Date().toISOString()
          return put("chore", m.family_id, r.owner_id, {
            ...v,
            status,
            updatedAt: now,
            completedAt: status === "done" ? now : null,
            completedByMemberId: status === "done" ? actor.id : null,
            revision: r.revision + 1,
          })
        })
      }
    }
    if (path === "mind/suggestions" && method === "POST") {
      const b = parse(
        z.object({
          rawText: text(500),
          recipientMemberId: id,
          clientDraftVersion: z.union([
            z.string().max(128),
            z.number().int().nonnegative(),
          ]),
        }),
        body
      )
      checkMembers(m.family_id, [b.recipientMemberId])
      if (b.recipientMemberId === actor.id)
        fail("INPUT_INVALID", 422, "다른 가족을 골라 주세요.")
      if (!suggest)
        fail(
          "AI_UNAVAILABLE",
          503,
          "AI 제안이 아직 연결되지 않았어요. 직접 문장을 다듬어 전송할 수 있어요."
        )
      const recipient = members(m.family_id).find(
        (x) => x.user_id === b.recipientMemberId
      )!
      let proposed: string
      try {
        proposed = await suggest(b.rawText, recipient.name, {
          actorId: actor.id,
          recipientId: recipient.user_id,
          familyId: m.family_id,
        })
      } catch (error) {
        if (error instanceof V2Error) throw error
        fail(
          "AI_UNAVAILABLE",
          503,
          "AI 제안을 완료하지 못했어요. 잠시 후 다시 시도해 주세요."
        )
      }
      const safe = text(500).safeParse(proposed)
      if (!safe.success)
        fail(
          "AI_INVALID_RESULT",
          503,
          "AI 제안을 확인하지 못했어요. 직접 문장을 다듬어 주세요."
        )
      return {
        mode: "suggested",
        text: safe.data,
        label: "AI 제안 · 보내기 전 확인해 주세요",
        clientDraftVersion: b.clientDraftVersion,
      }
    }
    if (path === "mind/messages") {
      if (method === "GET")
        return list<MindMessage>(actor, "message")
          .filter((v) => v.fromId === actor.id || v.toId === actor.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      if (method === "POST") {
        const b = parse(
          z.object({ text: text(500), recipientMemberId: id, requestId }),
          body
        )
        return mutate(actor, method, path, b, () => {
          checkMembers(m.family_id, [b.recipientMemberId])
          if (b.recipientMemberId === actor.id)
            fail("INPUT_INVALID", 422, "다른 가족을 골라 주세요.")
          return put("message", m.family_id, actor.id, {
            id: randomUUID(),
            revision: 1,
            fromId: actor.id,
            toId: b.recipientMemberId,
            text: b.text,
            createdAt: new Date().toISOString(),
            status: "sent",
            response: null,
          })
        })
      }
    }
    match = path.match(/^mind\/messages\/([^/]+)(\/(read|response))?$/)
    if (match) {
      const objectId = match[1],
        action = match[3]
      if (method === "GET" && !action) return message(actor, objectId).v
      if (method === "PUT" && (action === "read" || action === "response")) {
        const b = parse(
          action === "read"
            ? z.object({ requestId })
            : z.object({
                requestId,
                expectedRevision: revision,
                response: z.discriminatedUnion("kind", [
                  z.object({ kind: z.literal("reply"), text: text(300) }),
                  z.object({ kind: z.literal("later") }),
                  z.object({ kind: z.literal("declined") }),
                ]),
              }),
          body
        )
        return mutate(actor, method, path, b, () => {
          const { r, v } = message(actor, objectId)
          if (v.toId !== actor.id) denied()
          if (action === "read") {
            if (v.status !== "sent") return v
            return put("message", m.family_id, r.owner_id, {
              ...v,
              status: "read",
              revision: r.revision + 1,
            })
          }
          const data = b as unknown as {
            expectedRevision: number
            response:
              { kind: "reply"; text: string } | { kind: "later" | "declined" }
          }
          requireRevision(r, data.expectedRevision)
          if (v.response)
            fail("ALREADY_RESPONDED", 409, "이미 응답한 메시지예요.")
          return put("message", m.family_id, r.owner_id, {
            ...v,
            status:
              data.response.kind === "reply" ? "replied" : data.response.kind,
            response: { ...data.response, at: new Date().toISOString() },
            revision: r.revision + 1,
          })
        })
      }
    }
    if (path === "memories") {
      if (method === "GET") {
        const posts = list<MemoryPost>(actor, "memory").sort(
          (a, b) =>
            b.memoryDate.localeCompare(a.memoryDate) ||
            b.createdAt.localeCompare(a.createdAt)
        )
        return {
          posts,
          assets: posts.map((p) => remote(asset(actor, p.assetId).v)),
        }
      }
      if (method === "POST") {
        const b = parse(
          z.object({
            requestId,
            fields: z.object({
              assetId: id,
              memoryDate: date,
              caption: z.string().trim().max(200),
            }),
          }),
          body
        )
        return mutate(actor, method, path, b, () => {
          const { r, v } = asset(actor, b.fields.assetId)
          if (r.owner_id !== actor.id) denied()
          if (v.state !== "pending")
            fail("ASSET_ATTACHED", 409, "이미 등록한 사진이에요.")
          put("asset", m.family_id, actor.id, {
            ...v,
            state: "attached",
            revision: r.revision + 1,
          })
          return put("memory", m.family_id, actor.id, {
            ...b.fields,
            id: randomUUID(),
            authorId: actor.id,
            createdAt: new Date().toISOString(),
            revision: 1,
          })
        })
      }
    }
    match = path.match(/^memories\/([^/]+)$/)
    if (match) {
      const objectId = match[1]
      if (method === "GET")
        return decode<MemoryPost>(row(actor, "memory", objectId))
      if (method === "DELETE") {
        const b = parse(
          z.object({ expectedRevision: revision, requestId }),
          body
        )
        const result = mutate(actor, method, path, b, () => {
          const r = row(actor, "memory", objectId)
          if (r.owner_id !== actor.id) denied()
          requireRevision(r, b.expectedRevision)
          const post = decode<MemoryPost>(r),
            a = asset(actor, post.assetId)
          put("asset", m.family_id, actor.id, {
            ...a.v,
            state: "deleting",
            revision: a.r.revision + 1,
          })
          db.prepare("DELETE FROM v2_records WHERE id=?").run(objectId)
          return { id: objectId, deleted: true }
        })
        await cleanup()
        return result
      }
    }
    missing()
  }

  async function upload(
    actor: V2Actor,
    bytes: Uint8Array,
    mime: string
  ): Promise<RemoteAsset> {
    const m = member(actor)
    if (bytes.byteLength > 10 * 1024 * 1024)
      fail("IMAGE_TOO_LARGE", 413, "사진은 10MiB 이하로 골라 주세요.")
    if (!["image/jpeg", "image/png", "image/webp"].includes(mime))
      fail("UNSUPPORTED_MEDIA", 415, "JPEG, PNG, WebP 사진만 사용할 수 있어요.")
    let encoded: Buffer, width: number, height: number
    try {
      const input = sharp(bytes, {
          limitInputPixels: 20_000_000,
          animated: false,
          failOn: "warning",
        }),
        metadata = await input.metadata()
      const expected = {
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp",
      }[metadata.format as "jpeg" | "png" | "webp"]
      if (!expected || expected !== mime || (metadata.pages ?? 1) > 1)
        fail("UNSUPPORTED_MEDIA", 415, "사진의 실제 형식이 올바르지 않아요.")
      const result = await input
        .rotate()
        .webp({ quality: 85 })
        .toBuffer({ resolveWithObject: true })
      encoded = result.data
      width = result.info.width
      height = result.info.height
    } catch (e) {
      if (e instanceof V2Error) throw e
      fail(
        "INVALID_IMAGE",
        422,
        "사진을 읽을 수 없어요. 다른 사진을 골라 주세요."
      )
    }
    const assetId = randomUUID(),
      file = `${assetId}.webp`
    await mkdir(uploadDir, { recursive: true, mode: 0o700 })
    await writeFile(resolve(uploadDir, file), encoded, {
      flag: "wx",
      mode: 0o600,
    })
    const value: Asset & { revision: number } = {
      id: assetId,
      kind: "remote",
      url: `/api/v2/memories/assets/${assetId}/content`,
      mime: "image/webp",
      width,
      height,
      bytes: encoded.byteLength,
      state: "pending",
      createdAt: new Date().toISOString(),
      file,
      revision: 1,
    }
    try {
      transaction(() => put("asset", m.family_id, actor.id, value))
    } catch (e) {
      await unlink(resolve(uploadDir, file)).catch(() => {})
      throw e
    }
    return remote(value)
  }
  async function content(actor: V2Actor, assetId: string) {
    const { v } = asset(actor, assetId)
    try {
      return {
        bytes: new Uint8Array(await readFile(resolve(uploadDir, v.file))),
        mime: v.mime,
      }
    } catch {
      return missing()
    }
  }
  async function cleanup(): Promise<number> {
    const rows = db
      .prepare("SELECT * FROM v2_records WHERE kind='asset'")
      .all() as Row[]
    let count = 0
    for (const r of rows) {
      const a = decode<Asset>(r)
      if (
        a.state === "deleting" ||
        (a.state === "pending" &&
          Date.parse(a.createdAt) < Date.now() - 86400000)
      ) {
        // Claim inside a transaction: cannot race a successful attach.
        const claimed = transaction(() => {
          const current = db
            .prepare("SELECT * FROM v2_records WHERE id=?")
            .get(r.id) as Row | undefined
          if (!current) return false
          const v = decode<Asset>(current)
          if (
            v.state !== "deleting" &&
            !(
              v.state === "pending" &&
              Date.parse(v.createdAt) < Date.now() - 86400000
            )
          )
            return false
          put("asset", current.family_id, current.owner_id, {
            ...v,
            state: "deleting",
            revision: current.revision + 1,
          })
          return true
        })
        if (!claimed) continue
        try {
          await unlink(resolve(uploadDir, a.file))
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== "ENOENT") continue
        }
        db.prepare("DELETE FROM v2_records WHERE id=? AND kind='asset'").run(
          r.id
        )
        count++
      }
    }
    return count
  }
  return { request, upload, content, cleanup }
}
