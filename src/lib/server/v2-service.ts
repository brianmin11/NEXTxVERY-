import { createHash, createHmac, randomUUID } from "node:crypto"
import { resolve } from "node:path"
import type { DatabaseSync } from "node:sqlite"
import { asServiceDatabase } from "./service-database"
import { createLocalAssetStore } from "./asset-store"
import type {
  ServiceDatabase,
  PrivateAssetStore,
} from "../../contracts/storage"
import sharp from "sharp"
import { z } from "zod"
import { isValidDateKey, isValidTimeKey } from "../../../lib/calendar/date"
import { DEFAULT_CHARACTER, isValidCharacter, type CharacterConfig } from "../../../lib/character/catalog"
import { MEMBER_NAME_MAX_LENGTH } from "../../../lib/family/config"
import { DEFAULT_THEME, isSceneTheme, type SceneTheme } from "../../../lib/scene/themes"
import type { CalendarEvent } from "../../../lib/calendar/types"
import type { Chore } from "../../../lib/chores/types"
import type { MindMessage } from "../../../lib/mind/types"
import type { MemoryPost } from "../../../lib/memories/types"
export type V2Actor = {
  id: string
  name: string
  email?: string
}
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
type Membership = {
  user_id: string
  family_id: string
  name: string
}
type Versioned<T> = T & {
  revision: number
}
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
  db: DatabaseSync | ServiceDatabase
  assetStore?: PrivateAssetStore
  uploadDir?: string
  suggest?: (
    rawText: string,
    recipientName: string,
    context: {
      actorId: string
      recipientId: string
      familyId: string
    }
  ) => Promise<string>
}
export function createV2Service({
  db: inputDatabase,
  assetStore,
  uploadDir = resolve(".data/uploads"),
  suggest,
  inviteSecret,
}: Options) {
  const db = asServiceDatabase(inputDatabase)
  const store = assetStore ?? createLocalAssetStore(uploadDir)
  const transaction = <T>(fn: () => Promise<T>) => db.transaction(fn)
  async function member(actor: V2Actor): Promise<Membership> {
    const m = (await db
      .prepare("SELECT * FROM v2_members WHERE user_id=?")
      .get(actor.id)) as Membership | undefined
    if (!m) fail("FAMILY_REQUIRED", 403, "먼저 가족 공간에 참여해 주세요.")
    return m
  }
  async function members(familyId: string) {
    return (await db
      .prepare("SELECT * FROM v2_members WHERE family_id=? ORDER BY user_id")
      .all(familyId)) as Membership[]
  }
  async function checkMembers(familyId: string, ids: string[]) {
    const allowed = new Set((await members(familyId)).map((m) => m.user_id))
    if (ids.some((x) => !allowed.has(x)) || new Set(ids).size !== ids.length)
      fail("INPUT_INVALID", 422, "같은 가족의 구성원을 선택해 주세요.")
  }
  /** 가족 공통 설정(관리자·테마). 가족을 만든 사람이 초기 관리자이고 역할(엄마·아빠)과 별개다. */
  type FamilySettings = { id: string; revision: number; adminMemberId: string; theme: SceneTheme }
  /** 구성원 본인 캐릭터. v2_records(kind="profile", id=user_id)에 둔다. */
  type Profile = { id: string; revision: number; avatar: CharacterConfig }
  const TONES = ["apricot", "sky", "butter", "sage"] as const
  async function recordsOf<T>(familyId: string, kind: string): Promise<Map<string, Versioned<T>>> {
    const rows = (await db
      .prepare("SELECT * FROM v2_records WHERE family_id=? AND kind=?")
      .all(familyId, kind)) as Row[]
    return new Map(rows.map((r) => [r.id, decode<T>(r)]))
  }
  async function settingsOf(familyId: string, memberRows: Membership[]): Promise<FamilySettings> {
    const found = (await recordsOf<FamilySettings>(familyId, "family-settings")).get(familyId)
    if (found) return found
    // 설정 레코드가 없는 예전 가족: user_id 정렬상 첫 구성원을 관리자로 본다(결정적이지만 임의). 설정을 저장하면 그 값이 우선한다.
    return { id: familyId, revision: 0, adminMemberId: memberRows[0]?.user_id ?? "", theme: DEFAULT_THEME }
  }
  async function session(actor: V2Actor) {
    const m = (await db
      .prepare("SELECT * FROM v2_members WHERE user_id=?")
      .get(actor.id)) as Membership | undefined
    const family = m
      ? ((await db
          .prepare("SELECT * FROM v2_families WHERE id=?")
          .get(m.family_id)) as
          | {
              id: string
              name: string
            }
          | undefined)
      : undefined
    if (!family) return { viewer: { id: actor.id, name: actor.name }, family: null }
    const memberRows = await members(family.id)
    const settings = await settingsOf(family.id, memberRows)
    const profiles = await recordsOf<Profile>(family.id, "profile")
    return {
      viewer: { id: actor.id, name: actor.name },
      family: {
        id: family.id,
        name: family.name,
        adminMemberId: settings.adminMemberId,
        theme: settings.theme,
        members: memberRows.map((x, i) => ({
          id: x.user_id,
          name: x.name,
          tone: TONES[i % TONES.length],
          avatar: profiles.get(x.user_id)?.avatar ?? DEFAULT_CHARACTER,
        })),
      },
    }
  }
  async function row(
    actor: V2Actor,
    kind: string,
    objectId: string
  ): Promise<Row> {
    const m = await member(actor),
      r = (await db
        .prepare(
          "SELECT * FROM v2_records WHERE id=? AND kind=? AND family_id=?"
        )
        .get(objectId, kind, m.family_id)) as Row | undefined
    if (!r) return missing()
    return r
  }
  function decode<T>(r: Row): Versioned<T> {
    return { ...JSON.parse(r.payload), revision: r.revision }
  }
  async function list<T>(
    actor: V2Actor,
    kind: string
  ): Promise<Versioned<T>[]> {
    const m = await member(actor)
    return (
      (await db
        .prepare(
          "SELECT * FROM v2_records WHERE family_id=? AND kind=? ORDER BY id"
        )
        .all(m.family_id, kind)) as Row[]
    ).map((r) => decode<T>(r))
  }
  async function put<
    T extends {
      id: string
      revision: number
    },
  >(kind: string, familyId: string, ownerId: string, value: T) {
    await db
      .prepare(
        "INSERT INTO v2_records(id,kind,family_id,owner_id,revision,payload) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload"
      )
      .run(
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
  async function mutate<T>(
    actor: V2Actor,
    method: string,
    path: string,
    body: unknown,
    fn: () => Promise<T>
  ): Promise<T> {
    const token = parse(z.object({ requestId }), body).requestId
    const payloadHash = hash(canonical({ method, path, body }))
    return await transaction(async () => {
      const old = (await db
        .prepare(
          "SELECT payload_hash,result FROM v2_receipts WHERE actor_id=? AND request_id=?"
        )
        .get(actor.id, token)) as
        | {
            payload_hash: string
            result: string
          }
        | undefined
      if (old) {
        if (old.payload_hash !== payloadHash)
          fail(
            "IDEMPOTENCY_CONFLICT",
            409,
            "같은 요청 번호로 다른 내용을 저장할 수 없어요."
          )
        return JSON.parse(old.result) as T
      }
      const result = await fn()
      await db
        .prepare(
          "INSERT INTO v2_receipts(actor_id,request_id,payload_hash,result) VALUES(?,?,?,?)"
        )
        .run(actor.id, token, payloadHash, JSON.stringify(result))
      return result
    })
  }
  async function message(actor: V2Actor, objectId: string) {
    const r = await row(actor, "message", objectId),
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
  async function asset(actor: V2Actor, objectId: string) {
    const r = await row(actor, "asset", objectId),
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
    if (method === "GET" && path === "session") return await session(actor)
    if (method === "POST" && path === "families") {
      const b = parse(z.object({ name: text(80), requestId }), body)
      return await mutate(actor, method, path, b, async () => {
        if (
          await db
            .prepare("SELECT user_id FROM v2_members WHERE user_id=?")
            .get(actor.id)
        )
          fail("ALREADY_JOINED", 409, "이미 가족에 참여하고 있어요.")
        const familyId = randomUUID()
        await db
          .prepare("INSERT INTO v2_families(id,name) VALUES(?,?)")
          .run(familyId, b.name)
        await db
          .prepare(
            "INSERT INTO v2_members(user_id,family_id,name) VALUES(?,?,?)"
          )
          .run(actor.id, familyId, actor.name)
        // 만든 사람이 초기 관리자. 테마는 기본값으로 시작한다.
        await put("family-settings", familyId, actor.id, { id: familyId, revision: 1, adminMemberId: actor.id, theme: DEFAULT_THEME })
        return await session(actor)
      })
    }
    if (method === "POST" && path === "family/join") {
      const b = parse(
        z.object({ inviteCode: z.string().min(16).max(128), requestId }),
        body
      )
      return await mutate(actor, method, path, b, async () => {
        if (
          await db
            .prepare("SELECT user_id FROM v2_members WHERE user_id=?")
            .get(actor.id)
        )
          fail("ALREADY_JOINED", 409, "이미 가족에 참여하고 있어요.")
        const invite = (await db
          .prepare(
            "SELECT family_id,expires_at FROM v2_invites WHERE code_hash=?"
          )
          .get(hash(b.inviteCode))) as
          | {
              family_id: string
              expires_at: string
            }
          | undefined
        if (!invite || Date.parse(invite.expires_at) <= Date.now())
          fail("INVITE_INVALID", 422, "초대 코드가 없거나 만료됐어요.")
        await db
          .prepare(
            "INSERT INTO v2_members(user_id,family_id,name) VALUES(?,?,?)"
          )
          .run(actor.id, invite.family_id, actor.name)
        return await session(actor)
      })
    }
    const m = await member(actor)
    const isAdmin = async () => (await settingsOf(m.family_id, await members(m.family_id))).adminMemberId === actor.id
    if (method === "PUT" && path === "family/settings") {
      // 관리자만 가족 이름·공통 테마를 바꾼다. 구성원 캐릭터·일정·사진·집안일·메시지는 건드리지 않는다.
      const b = parse(
        z.object({ requestId, name: text(80).optional(), theme: z.string().refine(isSceneTheme).optional() }).strip(),
        body
      )
      return await mutate(actor, method, path, b, async () => {
        if (!(await isAdmin())) denied()
        if (b.name !== undefined) await db.prepare("UPDATE v2_families SET name=? WHERE id=?").run(b.name, m.family_id)
        if (b.theme !== undefined) {
          const current = await settingsOf(m.family_id, await members(m.family_id))
          await put("family-settings", m.family_id, actor.id, { ...current, id: m.family_id, theme: b.theme as SceneTheme, revision: current.revision + 1 })
        }
        return await session(actor)
      })
    }
    if (method === "PUT" && path === "me/profile") {
      // 본인 이름·캐릭터만. 다른 구성원은 바꿀 수 없다.
      const b = parse(
        z
          .object({
            requestId,
            name: z.string().trim().min(1).max(MEMBER_NAME_MAX_LENGTH).optional(),
            avatar: z.custom<CharacterConfig>((v) => isValidCharacter(v), "카탈로그에 없는 캐릭터 설정이에요.").optional(),
          })
          .strip(),
        body
      )
      return await mutate(actor, method, path, b, async () => {
        if (b.name !== undefined) await db.prepare("UPDATE v2_members SET name=? WHERE user_id=?").run(b.name, actor.id)
        if (b.avatar !== undefined) {
          const current = (await recordsOf<Profile>(m.family_id, "profile")).get(actor.id)
          await put("profile", m.family_id, actor.id, { id: actor.id, avatar: b.avatar, revision: (current?.revision ?? 0) + 1 })
        }
        return await session(actor)
      })
    }
    if (method === "POST" && path === "family/invites") {
      const b = parse(z.object({ requestId }), body)
      if (!(await isAdmin())) denied()
      if (!inviteSecret || inviteSecret.length < 32)
        fail("INVITE_UNAVAILABLE", 503, "초대 설정을 확인해 주세요.")
      const inviteCode = createHmac("sha256", inviteSecret)
        .update(
          JSON.stringify(["v2-invite", actor.id, m.family_id, b.requestId])
        )
        .digest("base64url")
      await mutate(actor, method, path, b, async () => {
        await db
          .prepare(
            "INSERT INTO v2_invites(code_hash,family_id,expires_at) VALUES(?,?,?)"
          )
          .run(
            hash(inviteCode),
            m.family_id,
            new Date(Date.now() + 86400000).toISOString()
          )
        return { created: true }
      })
      const storedInvite = (await db
        .prepare("SELECT expires_at FROM v2_invites WHERE code_hash=?")
        .get(hash(inviteCode))) as
        | {
            expires_at: string
          }
        | undefined
      if (!storedInvite || Date.parse(storedInvite.expires_at) <= Date.now())
        fail("INVITE_EXPIRED", 409, "새 초대 코드를 만들어 주세요.")
      return { inviteCode, expiresAt: storedInvite.expires_at }
    }
    if (path === "calendar/events") {
      if (method === "GET") return await list<CalendarEvent>(actor, "event")
      if (method === "POST") {
        const b = parse(z.object({ fields: calendarFields, requestId }), body)
        return await mutate(actor, method, path, b, async () => {
          await checkMembers(m.family_id, b.fields.participantIds)
          return await put("event", m.family_id, actor.id, {
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
        return decode<CalendarEvent>(await row(actor, "event", objectId))
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
        return await mutate(actor, method, path, b, async () => {
          const r = await row(actor, "event", objectId)
          if (r.owner_id !== actor.id) denied()
          requireRevision(r, b.expectedRevision)
          if (method === "DELETE") {
            await db.prepare("DELETE FROM v2_records WHERE id=?").run(r.id)
            return { id: r.id, deleted: true }
          }
          const fields = (
            b as unknown as {
              fields: z.infer<typeof calendarFields>
            }
          ).fields
          await checkMembers(m.family_id, fields.participantIds)
          return await put("event", m.family_id, actor.id, {
            ...decode<CalendarEvent>(r),
            ...fields,
            revision: r.revision + 1,
          })
        })
      }
    }
    if (path === "chores") {
      if (method === "GET") return await list<Chore>(actor, "chore")
      if (method === "POST") {
        const b = parse(z.object({ fields: choreFields, requestId }), body)
        return await mutate(actor, method, path, b, async () => {
          await checkMembers(m.family_id, [b.fields.assigneeMemberId])
          const now = new Date().toISOString()
          return await put("chore", m.family_id, actor.id, {
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
        return decode<Chore>(await row(actor, "chore", objectId))
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
        return await mutate(actor, method, path, b, async () => {
          const r = await row(actor, "chore", objectId),
            v = decode<Chore>(r)
          if (method === "PUT") {
            if (r.owner_id !== actor.id && v.assigneeMemberId !== actor.id)
              denied()
          } else if (r.owner_id !== actor.id) denied()
          requireRevision(r, b.expectedRevision)
          if (method === "DELETE") {
            await db.prepare("DELETE FROM v2_records WHERE id=?").run(r.id)
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
              b as unknown as {
                fields: z.infer<typeof choreFields>
              }
            ).fields
            await checkMembers(m.family_id, [fields.assigneeMemberId])
            return await put("chore", m.family_id, r.owner_id, {
              ...v,
              ...fields,
              updatedAt: new Date().toISOString(),
              revision: r.revision + 1,
            })
          }
          const status = (
            b as unknown as {
              status: "todo" | "done"
            }
          ).status
          if (v.status === status) return v
          const now = new Date().toISOString()
          return await put("chore", m.family_id, r.owner_id, {
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
      await checkMembers(m.family_id, [b.recipientMemberId])
      if (b.recipientMemberId === actor.id)
        fail("INPUT_INVALID", 422, "다른 가족을 골라 주세요.")
      if (!suggest)
        fail(
          "AI_UNAVAILABLE",
          503,
          "AI 제안이 아직 연결되지 않았어요. 직접 문장을 다듬어 전송할 수 있어요."
        )
      const recipient = (await members(m.family_id)).find(
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
        return (await list<MindMessage>(actor, "message"))
          .filter((v) => v.fromId === actor.id || v.toId === actor.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      if (method === "POST") {
        const b = parse(
          z.object({ text: text(500), recipientMemberId: id, requestId }),
          body
        )
        return await mutate(actor, method, path, b, async () => {
          await checkMembers(m.family_id, [b.recipientMemberId])
          if (b.recipientMemberId === actor.id)
            fail("INPUT_INVALID", 422, "다른 가족을 골라 주세요.")
          return await put("message", m.family_id, actor.id, {
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
      if (method === "GET" && !action) return (await message(actor, objectId)).v
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
        return await mutate(actor, method, path, b, async () => {
          const { r, v } = await message(actor, objectId)
          if (v.toId !== actor.id) denied()
          if (action === "read") {
            if (v.status !== "sent") return v
            return await put("message", m.family_id, r.owner_id, {
              ...v,
              status: "read",
              revision: r.revision + 1,
            })
          }
          const data = b as unknown as {
            expectedRevision: number
            response:
              | {
                  kind: "reply"
                  text: string
                }
              | {
                  kind: "later" | "declined"
                }
          }
          requireRevision(r, data.expectedRevision)
          if (v.response)
            fail("ALREADY_RESPONDED", 409, "이미 응답한 메시지예요.")
          return await put("message", m.family_id, r.owner_id, {
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
        const posts = (await list<MemoryPost>(actor, "memory")).sort(
          (a, b) =>
            b.memoryDate.localeCompare(a.memoryDate) ||
            b.createdAt.localeCompare(a.createdAt)
        )
        return {
          posts,
          assets: await Promise.all(
            posts.map(async (p) => remote((await asset(actor, p.assetId)).v))
          ),
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
        return await mutate(actor, method, path, b, async () => {
          const { r, v } = await asset(actor, b.fields.assetId)
          if (r.owner_id !== actor.id) denied()
          if (v.state !== "pending")
            fail("ASSET_ATTACHED", 409, "이미 등록한 사진이에요.")
          await put("asset", m.family_id, actor.id, {
            ...v,
            state: "attached",
            revision: r.revision + 1,
          })
          return await put("memory", m.family_id, actor.id, {
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
        return decode<MemoryPost>(await row(actor, "memory", objectId))
      if (method === "DELETE") {
        const b = parse(
          z.object({ expectedRevision: revision, requestId }),
          body
        )
        const result = await mutate(actor, method, path, b, async () => {
          const r = await row(actor, "memory", objectId)
          if (r.owner_id !== actor.id) denied()
          requireRevision(r, b.expectedRevision)
          const post = decode<MemoryPost>(r),
            a = await asset(actor, post.assetId)
          await put("asset", m.family_id, actor.id, {
            ...a.v,
            state: "deleting",
            revision: a.r.revision + 1,
          })
          await db.prepare("DELETE FROM v2_records WHERE id=?").run(objectId)
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
    const m = await member(actor)
    if (bytes.byteLength > 10 * 1024 * 1024)
      fail("IMAGE_TOO_LARGE", 413, "사진은 10MiB 이하로 골라 주세요.")
    if (!["image/jpeg", "image/png", "image/webp"].includes(mime))
      fail("UNSUPPORTED_MEDIA", 415, "JPEG, PNG, WebP 사진만 사용할 수 있어요.")
    let encoded: Buffer, width: number, height: number
    try {
      const input = sharp(bytes, {
          limitInputPixels: 20000000,
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
    await store.put(file, encoded)
    const value: Asset & {
      revision: number
    } = {
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
      await transaction(
        async () => await put("asset", m.family_id, actor.id, value)
      )
    } catch (e) {
      await store.remove(file).catch(() => {})
      throw e
    }
    return remote(value)
  }
  async function content(actor: V2Actor, assetId: string) {
    const { v } = await asset(actor, assetId)
    try {
      return {
        bytes: new Uint8Array(await store.get(v.file)),
        mime: v.mime,
      }
    } catch {
      return missing()
    }
  }
  async function cleanup(): Promise<number> {
    const rows = (await db
      .prepare("SELECT * FROM v2_records WHERE kind='asset'")
      .all()) as Row[]
    let count = 0
    for (const r of rows) {
      const a = decode<Asset>(r)
      if (
        a.state === "deleting" ||
        (a.state === "pending" &&
          Date.parse(a.createdAt) < Date.now() - 86400000)
      ) {
        // Claim inside a transaction: cannot race a successful attach.
        const claimed = await transaction(async () => {
          const current = (await db
            .prepare("SELECT * FROM v2_records WHERE id=?")
            .get(r.id)) as Row | undefined
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
          await put("asset", current.family_id, current.owner_id, {
            ...v,
            state: "deleting",
            revision: current.revision + 1,
          })
          return true
        })
        if (!claimed) continue
        try {
          await store.remove(a.file)
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== "ENOENT") continue
        }
        await db
          .prepare("DELETE FROM v2_records WHERE id=? AND kind='asset'")
          .run(r.id)
        count++
      }
    }
    // A crash after writing a file but before inserting its asset row can leave an orphan.
    // Only reclaim server-generated regular files older than the pending asset TTL.
    for await (const entry of store.list()) {
      if (
        !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.webp$/.test(
          entry.key
        )
      )
        continue
      const assetId = entry.key.slice(0, -5)
      if (
        await db
          .prepare("SELECT 1 FROM v2_records WHERE id=? AND kind='asset'")
          .get(assetId)
      )
        continue
      try {
        if (entry.modifiedAt >= Date.now() - 86400000) continue
        // New uploads have a fresh mtime; an in-flight upload cannot be reclaimed here.
        await store.remove(entry.key)
        count++
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") continue
      }
    }
    return count
  }
  return { request, upload, content, cleanup }
}
