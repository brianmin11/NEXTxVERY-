import { randomBytes, randomUUID } from "node:crypto"
import type { DatabaseSync } from "node:sqlite"
import {
  compileChangePlan,
  hash,
  RelationshipError,
  type RelationshipEngine,
  type RunOptions,
  type JointContext,
  type PrivateContext,
  type DerivedArtifactMetadata,
} from "@family-os/relationship-ai"
import {
  Command,
  type Actor,
  type Coordination,
  type FamilyView,
  type PrivateEntry,
  type SharedCard,
  type Schedule,
  type CommandResult,
} from "../../contracts/family"

export class HostError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string
  ) {
    super(message)
    this.name = "HostError"
  }
}
const fail = (code: string, status: number, message: string): never => {
  throw new HostError(code, status, message)
}
const stale = (): never =>
  fail("STALE_CONTEXT", 409, "내용이 변경됐어요. 최신 내용을 확인해 주세요.")
const forbidden = (): never =>
  fail("FORBIDDEN", 403, "이 내용에 접근할 수 없어요.")
const missing = (): never => fail("NOT_FOUND", 404, "내용을 찾을 수 없어요.")
type Household = {
  id: string
  name: string
  invite_code: string
  revision: number
}
type DocumentRow = {
  id: string
  kind: string
  household_id: string
  owner_id: string | null
  revision: number
  payload: string
}
type PrivateDoc = PrivateEntry & {
  ownerId: string
  sourceRevision: number
  validUntil: string
  coordinationRevision?: number
  personalMetadata?: DerivedArtifactMetadata
  shareMetadata?: DerivedArtifactMetadata
  publishedCardId?: string
}
type CardDoc = SharedCard & { validUntil: string }
type PlanData = {
  sourceHash: string
  expiresAt: string
  originSemanticHash: string
  acceptances: { actorId: string; digest: string; at: string }[]
}
type CoordinationDoc = Omit<Coordination, "cards"> & {
  cards: CardDoc[]
  permissionEpoch: number
  agreementMetadata?: DerivedArtifactMetadata
  analysisMetadata?: DerivedArtifactMetadata
  planData?: PlanData
}
type Receipt = {
  state: "pending" | "done" | "failed"
  createdId?: string
  code?: string
  status?: number
  message?: string
}
type Config = {
  db: DatabaseSync
  engine: RelationshipEngine
  runOptions: RunOptions
  now?: () => string
  modelMode?: FamilyView["modelMode"]
}
const unique = (items: string[]) => new Set(items).size === items.length
const sorted = (items: string[]) => [...items].sort()
const sameIds = (a: string[], b: string[]) =>
  hash(sorted(a)) === hash(sorted(b))

/** The actor must be obtained from the authenticated server session, never request JSON. */
export function createFamilyService({
  db,
  engine,
  runOptions,
  now = () => new Date().toISOString(),
  modelMode = "unconfigured",
}: Config) {
  const timestamp = () => {
    const t = now()
    if (!Number.isFinite(Date.parse(t))) throw new Error("Invalid server clock")
    return t
  }
  const expiry = () =>
    new Date(Date.parse(timestamp()) + 7 * 86400000).toISOString()
  const transaction = <T>(fn: () => T): T => {
    db.exec("BEGIN IMMEDIATE")
    try {
      const result = fn()
      db.exec("COMMIT")
      return result
    } catch (error) {
      db.exec("ROLLBACK")
      throw error
    }
  }
  const householdFor = (actor: Actor): Household | undefined =>
    db
      .prepare(
        "SELECT h.* FROM households h JOIN memberships m ON m.household_id=h.id WHERE m.user_id=?"
      )
      .get(actor.id) as Household | undefined
  const requireHousehold = (actor: Actor): Household =>
    householdFor(actor) ??
    fail(
      "HOUSEHOLD_REQUIRED",
      422,
      "먼저 가족을 만들거나 초대 코드로 참가해 주세요."
    )
  const membersFor = (householdId: string) =>
    db
      .prepare(
        "SELECT user_id AS id,name FROM memberships WHERE household_id=? ORDER BY user_id"
      )
      .all(householdId) as { id: string; name: string }[]
  const documents = <T>(householdId: string, kind: string): T[] =>
    (
      db
        .prepare(
          "SELECT payload FROM documents WHERE household_id=? AND kind=? ORDER BY rowid"
        )
        .all(householdId, kind) as { payload: string }[]
    ).map((row) => JSON.parse(row.payload) as T)
  const row = (id: string, kind: string, householdId: string): DocumentRow => {
    const result = db
      .prepare(
        "SELECT * FROM documents WHERE id=? AND kind=? AND household_id=?"
      )
      .get(id, kind, householdId) as DocumentRow | undefined
    return result ?? missing()
  }
  const privateDoc = (id: string, actor: Actor, h: Household): PrivateDoc => {
    const r = row(id, "private", h.id)
    if (r.owner_id !== actor.id) forbidden()
    return JSON.parse(r.payload) as PrivateDoc
  }
  const coordinationDoc = (
    id: string,
    actor: Actor,
    h: Household
  ): CoordinationDoc => {
    const c = JSON.parse(
      row(id, "coordination", h.id).payload
    ) as CoordinationDoc
    if (!c.audience.includes(actor.id)) forbidden()
    return c
  }
  const scheduleDoc = (id: string, h: Household): Schedule =>
    JSON.parse(row(id, "schedule", h.id).payload) as Schedule
  const put = (
    kind: string,
    householdId: string,
    value: { id: string; revision: number },
    ownerId: string | null = null
  ) => {
    db.prepare(
      "INSERT INTO documents(id,kind,household_id,owner_id,revision,payload) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload"
    ).run(
      value.id,
      kind,
      householdId,
      ownerId,
      value.revision,
      JSON.stringify(value)
    )
  }
  const assertRevision = (actual: number, expected: number) => {
    if (actual !== expected) stale()
  }
  const assertMembers = (h: Household, ids: string[]) => {
    const members = new Set(membersFor(h.id).map((m) => m.id))
    if (!ids.length || !unique(ids) || ids.some((id) => !members.has(id)))
      fail("INVALID_PARTICIPANTS", 422, "참여자를 다시 확인해 주세요.")
  }
  const assertRange = (start: string, end: string) => {
    if (
      !Number.isFinite(Date.parse(start)) ||
      !Number.isFinite(Date.parse(end)) ||
      Date.parse(end) <= Date.parse(start) ||
      Date.parse(start) <= Date.parse(timestamp())
    )
      fail(
        "INVALID_TIME",
        422,
        "미래의 시작 시각과 그 이후 종료 시각을 입력해 주세요."
      )
  }
  const assertNoConflict = (
    h: Household,
    start: string,
    end: string,
    participantIds: string[],
    targetId?: string
  ) => {
    const schedules = documents<Schedule>(h.id, "schedule")
    if (
      schedules.some(
        (s) =>
          s.id !== targetId &&
          s.participantIds.some((id) => participantIds.includes(id)) &&
          Date.parse(start) < Date.parse(s.end) &&
          Date.parse(end) > Date.parse(s.start)
      )
    )
      fail(
        "SCHEDULE_CONFLICT",
        409,
        "선택한 시간에 겹치는 일정이 있어요. 다른 시간을 골라 주세요."
      )
  }
  const bumpHousehold = (h: Household) =>
    db.prepare("UPDATE households SET revision=revision+1 WHERE id=?").run(h.id)
  const sourceHash = (c: CoordinationDoc) =>
    hash({
      audience: sorted(c.audience),
      permissionEpoch: c.permissionEpoch,
      cards: c.cards.map((card) => ({
        id: card.id,
        revision: card.revision,
        state: card.state,
        validUntil: card.validUntil,
      })),
    })
  const assertCards = (c: CoordinationDoc, h: Household) => {
    assertMembers(h, c.audience)
    const active = c.cards.filter((card) => card.state === "active")
    if (
      !active.length ||
      active.some(
        (card) => Date.parse(card.validUntil) <= Date.parse(timestamp())
      )
    )
      stale()
    if (
      active.some(
        (card) =>
          !c.audience.includes(card.senderId) ||
          c.audience.some(
            (id) => id !== card.senderId && !card.recipients.includes(id)
          )
      )
    )
      forbidden()
  }
  const invalidate = (c: CoordinationDoc) => {
    delete c.analysis
    delete c.analysisMetadata
    delete c.agreement
    delete c.agreementMetadata
    if (c.plan) {
      c.plan.status = "stale"
      c.plan.acceptedBy = []
    }
    if (c.planData) c.planData.acceptances = []
    if (c.state !== "applied") c.state = "stale"
  }
  const publicPrivate = (p: PrivateDoc): PrivateEntry => ({
    id: p.id,
    revision: p.revision,
    text: p.text,
    route: p.route,
    coordinationId: p.coordinationId,
    ...(p.personal ? { personal: p.personal } : {}),
    ...(p.shareDraft ? { shareDraft: p.shareDraft } : {}),
  })
  const publicCoordination = (c: CoordinationDoc): Coordination => {
    const live = c.cards.filter((card) => card.state === "active")
    const expired =
      !live.length ||
      live.some(
        (card) => Date.parse(card.validUntil) <= Date.parse(timestamp())
      )
    const safe =
      expired && c.state !== "applied"
        ? {
            ...c,
            state: "stale" as const,
            analysis: undefined,
            agreement: undefined,
            plan: c.plan
              ? { ...c.plan, status: "stale" as const, acceptedBy: [] }
              : undefined,
          }
        : c
    return {
      id: safe.id,
      revision: safe.revision,
      audience: [...safe.audience],
      state: safe.state,
      cards: safe.cards.map((card) => ({
        id: card.id,
        revision: card.revision,
        senderId: card.senderId,
        exactText:
          card.state === "active" &&
          Date.parse(card.validUntil) > Date.parse(timestamp())
            ? card.exactText
            : "",
        recipients: [...card.recipients],
        state: card.state,
        approvedAt: card.approvedAt,
      })),
      ...(safe.analysis ? { analysis: safe.analysis } : {}),
      ...(safe.agreement ? { agreement: safe.agreement } : {}),
      ...(safe.plan ? { plan: safe.plan } : {}),
    }
  }
  function read(actor: Actor): FamilyView {
    const h = householdFor(actor)
    if (!h)
      return {
        viewer: actor,
        household: null,
        members: [],
        schedules: [],
        privateEntries: [],
        coordinations: [],
        modelMode,
      }
    return {
      viewer: actor,
      household: { id: h.id, name: h.name, inviteCode: h.invite_code },
      members: membersFor(h.id),
      schedules: documents<Schedule>(h.id, "schedule"),
      privateEntries: (
        db
          .prepare(
            "SELECT payload FROM documents WHERE household_id=? AND kind=? AND owner_id=? ORDER BY rowid"
          )
          .all(h.id, "private", actor.id) as { payload: string }[]
      ).map((row) => publicPrivate(JSON.parse(row.payload) as PrivateDoc)),
      coordinations: documents<CoordinationDoc>(h.id, "coordination")
        .filter((c) => c.audience.includes(actor.id))
        .map(publicCoordination),
      modelMode,
    }
  }
  const privateContext = (
    p: PrivateDoc,
    h: Household,
    actor: Actor,
    recipients?: string[]
  ): PrivateContext => {
    if (Date.parse(p.validUntil) <= Date.parse(timestamp())) stale()
    const audience = recipients
      ? [actor.id, ...recipients]
      : membersFor(h.id).map((m) => m.id)
    return {
      scope: {
        schemaVersion: "1.0",
        actorId: actor.id,
        householdId: h.id,
        participantIds: audience,
        now: timestamp(),
        timezone: "Asia/Seoul",
        purpose: `coordination:${p.coordinationId}`,
        permissionEpoch: 1,
      },
      current: {
        id: p.id,
        revision: p.sourceRevision,
        text: p.text,
        ownerId: actor.id,
        validUntil: p.validUntil,
        state: "active",
      },
      memoryEnabled: false,
      historyStored: true,
      memories: [],
      route: p.route,
      clarificationTurns: 0,
    }
  }
  const jointContext = (
    c: CoordinationDoc,
    h: Household,
    actor: Actor
  ): JointContext => {
    assertCards(c, h)
    return {
      scope: {
        schemaVersion: "1.0",
        actorId: actor.id,
        householdId: h.id,
        participantIds: [...c.audience],
        now: timestamp(),
        timezone: "Asia/Seoul",
        purpose: `coordination:${c.id}`,
        permissionEpoch: c.permissionEpoch,
      },
      cards: c.cards
        .filter((card) => card.state === "active")
        .map((card) => ({
          schemaVersion: "1.0",
          id: card.id,
          revision: card.revision,
          senderId: card.senderId,
          householdId: h.id,
          exactText: card.exactText,
          recipients: card.recipients,
          purpose: `coordination:${c.id}`,
          validUntil: card.validUntil,
          state: "active",
          hostVerified: true,
          permissionEpoch: c.permissionEpoch,
        })),
      schedules: documents<Schedule>(h.id, "schedule")
        .filter((s) => s.participantIds.every((id) => c.audience.includes(id)))
        .map((s) => ({
          id: s.id,
          revision: s.revision,
          title: s.title,
          start: s.start,
          end: s.end,
          participantIds: s.participantIds,
        })),
    }
  }
  const assertSameSnapshot = (actor: Actor, h: Household) => {
    const current = requireHousehold(actor)
    if (current.id !== h.id || current.revision !== h.revision) stale()
  }
  const assertAgreementSources = (c: CoordinationDoc, h: Household) => {
    if (!c.agreementMetadata) stale()
    const versions = new Map([
      ...c.cards
        .filter((card) => card.state === "active")
        .map((card) => [card.id, card.revision] as const),
      ...documents<Schedule>(h.id, "schedule").map(
        (schedule) => [schedule.id, schedule.revision] as const
      ),
    ])
    if (
      c.agreementMetadata!.sourceVersions.some(
        (source) => versions.get(source.id) !== source.revision
      )
    )
      stale()
  }
  const livePlan = (c: CoordinationDoc, h: Household) => {
    if (!c.plan || !c.planData || !c.agreement || !c.agreementMetadata)
      fail("PLAN_REQUIRED", 422, "먼저 반영할 내용을 확인해 주세요.")
    const p = c.plan!,
      data = c.planData!
    if (
      c.state !== "open" ||
      c.agreement!.status !== "draft" ||
      ["stale", "applied"].includes(p.status)
    )
      stale()
    assertCards(c, h)
    assertAgreementSources(c, h)
    if (
      data.sourceHash !== sourceHash(c) ||
      Date.parse(data.expiresAt) <= Date.parse(timestamp()) ||
      Date.parse(c.agreementMetadata!.validUntil) <= Date.parse(timestamp()) ||
      p.agreementId !== c.agreement!.id ||
      p.agreementRevision !== c.agreement!.revision
    )
      stale()
    const target = scheduleDoc(p.targetId, h)
    if (target.revision !== p.targetRevision) stale()
    assertMembers(h, p.requiredAcceptors)
    assertMembers(h, p.participantIds)
    if (p.requiredAcceptors.some((id) => !c.audience.includes(id))) forbidden()
    assertRange(p.start, p.end)
    assertNoConflict(h, p.start, p.end, p.participantIds, p.targetId)
    return { p, data, target }
  }
  const notify = (
    h: Household,
    recipients: string[],
    target: string,
    kind: string
  ) => {
    for (const id of recipients)
      db.prepare(
        "INSERT INTO notifications(id,household_id,recipient_id,target_id,kind,created_at) VALUES(?,?,?,?,?,?)"
      ).run(randomUUID(), h.id, id, target, kind, timestamp())
  }

  async function execute(
    actor: Actor,
    cmd: Command
  ): Promise<string | undefined> {
    // Receipt completion shares the write transaction, so a process crash after commit
    // cannot leave a successful mutation looking uncommitted to a retry.
    const commitResult = (fn: () => string | undefined) =>
      transaction(() => {
        const createdId = fn()
        db.prepare(
          "UPDATE requests SET result=? WHERE actor_id=? AND request_id=?"
        ).run(
          JSON.stringify({ state: "done", createdId }),
          actor.id,
          cmd.requestId
        )
        return createdId
      })
    if (cmd.type === "household.create")
      return commitResult(() => {
        if (householdFor(actor))
          fail("ALREADY_JOINED", 409, "이미 가족에 참가했어요.")
        const id = randomUUID()
        db.prepare(
          "INSERT INTO households(id,name,invite_code) VALUES(?,?,?)"
        ).run(id, cmd.name, randomBytes(24).toString("base64url"))
        db.prepare(
          "INSERT INTO memberships(user_id,household_id,name) VALUES(?,?,?)"
        ).run(actor.id, id, actor.name)
        return id
      })
    if (cmd.type === "household.join")
      return commitResult(() => {
        if (householdFor(actor))
          fail("ALREADY_JOINED", 409, "이미 가족에 참가했어요.")
        const h = db
          .prepare("SELECT * FROM households WHERE invite_code=?")
          .get(cmd.inviteCode) as Household | undefined
        if (!h) fail("INVALID_INVITE", 404, "초대 코드를 확인해 주세요.")
        if (membersFor(h!.id).length >= 20)
          fail("HOUSEHOLD_FULL", 422, "가족 구성원 수가 한도에 도달했어요.")
        db.prepare(
          "INSERT INTO memberships(user_id,household_id,name) VALUES(?,?,?)"
        ).run(actor.id, h!.id, actor.name)
        bumpHousehold(h!)
        return h!.id
      })
    const h = requireHousehold(actor)
    if (cmd.type === "schedule.create")
      return commitResult(() => {
        assertMembers(h, cmd.participantIds)
        if (!cmd.participantIds.includes(actor.id)) forbidden()
        assertRange(cmd.start, cmd.end)
        assertNoConflict(h, cmd.start, cmd.end, cmd.participantIds)
        const schedule: Schedule = {
          id: randomUUID(),
          revision: 1,
          title: cmd.title,
          start: cmd.start,
          end: cmd.end,
          participantIds: sorted(cmd.participantIds),
        }
        put("schedule", h.id, schedule)
        bumpHousehold(h)
        return schedule.id
      })
    if (cmd.type === "private.create")
      return commitResult(() => {
        let coordinationRevision: number | undefined
        if (cmd.coordinationId) {
          const c = coordinationDoc(cmd.coordinationId, actor, h)
          if (c.state === "applied" || c.state === "declined") stale()
          coordinationRevision = c.revision
        }
        const p: PrivateDoc = {
          id: randomUUID(),
          revision: 1,
          text: cmd.text,
          route: cmd.route,
          coordinationId: cmd.coordinationId ?? randomUUID(),
          ownerId: actor.id,
          sourceRevision: 1,
          validUntil: expiry(),
          coordinationRevision,
        }
        put("private", h.id, p, actor.id)
        return p.id
      })
    if (cmd.type === "private.analyze" || cmd.type === "private.share") {
      const p = privateDoc(cmd.id, actor, h)
      assertRevision(p.revision, cmd.expectedRevision)
      if (cmd.type === "private.analyze") {
        const result = await engine.personal(
          privateContext(p, h, actor),
          runOptions
        )
        return commitResult(() => {
          assertSameSnapshot(actor, h)
          const current = privateDoc(p.id, actor, h)
          assertRevision(current.revision, p.revision)
          current.personal = result.value
          current.personalMetadata = result.metadata
          current.revision++
          delete current.shareDraft
          delete current.shareMetadata
          put("private", h.id, current, actor.id)
          return current.id
        })
      }
      if (
        p.route === "reflect" ||
        p.personal?.disposition === "private_support"
      )
        fail(
          "PRIVATE_ONLY",
          422,
          "현재 이야기는 개인 공간에서만 정리할 수 있어요."
        )
      assertMembers(h, cmd.recipients)
      if (cmd.recipients.includes(actor.id))
        fail(
          "INVALID_RECIPIENTS",
          422,
          "본인을 제외한 받는 사람을 선택해 주세요."
        )
      const existing = db
        .prepare(
          "SELECT payload FROM documents WHERE id=? AND kind=? AND household_id=?"
        )
        .get(p.coordinationId, "coordination", h.id) as
        { payload: string } | undefined
      if (existing) {
        const c = coordinationDoc(p.coordinationId, actor, h)
        if (!sameIds([actor.id, ...cmd.recipients], c.audience))
          fail(
            "AUDIENCE_CHANGE",
            422,
            "이 조율에 참여한 사람 모두에게 같은 문구를 공유해야 해요."
          )
      }
      const result = await engine.share(
        privateContext(p, h, actor, cmd.recipients),
        {
          id: randomUUID(),
          revision: 1,
          recipients: cmd.recipients,
          purpose: `coordination:${p.coordinationId}`,
          constraintsOnly: cmd.constraintsOnly,
        },
        runOptions
      )
      return commitResult(() => {
        assertSameSnapshot(actor, h)
        const current = privateDoc(p.id, actor, h)
        assertRevision(current.revision, p.revision)
        current.shareDraft = result.value
        current.shareMetadata = result.metadata
        current.revision++
        put("private", h.id, current, actor.id)
        return current.id
      })
    }
    if (cmd.type === "share.approve")
      return commitResult(() => {
        const p = privateDoc(cmd.id, actor, h)
        assertRevision(p.revision, cmd.expectedRevision)
        if (
          !p.shareDraft ||
          !p.shareMetadata ||
          p.personal?.disposition === "private_support" ||
          p.route === "reflect"
        )
          fail("SHARE_DRAFT_REQUIRED", 422, "전달할 문구를 먼저 검토해 주세요.")
        if (
          Date.parse(p.validUntil) <= Date.parse(timestamp()) ||
          Date.parse(p.shareMetadata!.validUntil) <= Date.parse(timestamp())
        )
          stale()
        assertMembers(h, cmd.recipients)
        if (
          cmd.recipients.includes(actor.id) ||
          !sameIds(cmd.recipients, p.shareDraft!.recipients)
        )
          fail(
            "AUDIENCE_CHANGE",
            422,
            "수신자를 변경하려면 공유 초안을 다시 만들어 주세요."
          )
        const stored = db
          .prepare(
            "SELECT payload FROM documents WHERE id=? AND kind=? AND household_id=?"
          )
          .get(p.coordinationId, "coordination", h.id) as
          { payload: string } | undefined
        let c: CoordinationDoc
        if (stored) {
          c = coordinationDoc(p.coordinationId, actor, h)
          if (!sameIds(c.audience, [actor.id, ...cmd.recipients])) forbidden()
          if (c.state === "declined" || c.state === "applied") stale()
        } else
          c = {
            id: p.coordinationId,
            revision: 0,
            audience: sorted([actor.id, ...cmd.recipients]),
            cards: [],
            state: "open",
            permissionEpoch: 1,
          }
        const prior = c.cards.find((card) => card.id === p.publishedCardId)
        if (prior) {
          prior.state = "revoked"
          prior.revision++
        }
        const card: CardDoc = {
          id: p.shareDraft!.id,
          revision:
            cmd.exactText === p.shareDraft!.exactText
              ? p.shareDraft!.revision
              : p.shareDraft!.revision + 1,
          senderId: actor.id,
          exactText: cmd.exactText,
          recipients: sorted(cmd.recipients),
          state: "active",
          approvedAt: timestamp(),
          validUntil: expiry(),
        }
        if (c.cards.some((old) => old.id === card.id))
          fail(
            "ALREADY_SHARED",
            409,
            "이미 공유한 문구예요. 새 초안을 만들어 주세요."
          )
        c.cards.push(card)
        invalidate(c)
        c.state = "open"
        c.revision++
        p.publishedCardId = card.id
        p.revision++
        delete p.shareDraft
        delete p.shareMetadata
        put("coordination", h.id, c)
        put("private", h.id, p, actor.id)
        notify(h, cmd.recipients, c.id, "share_approved")
        return c.id
      })
    if (cmd.type === "share.revoke")
      return commitResult(() => {
        const c = coordinationDoc(cmd.id, actor, h)
        assertRevision(c.revision, cmd.expectedRevision)
        const card = c.cards.find((card) => card.id === cmd.cardId)
        if (!card) missing()
        if (card!.senderId !== actor.id) forbidden()
        card!.state = "revoked"
        card!.revision++
        card!.exactText = ""
        c.permissionEpoch++
        c.revision++
        invalidate(c)
        put("coordination", h.id, c)
        return c.id
      })
    if (
      cmd.type === "coordination.generate" ||
      cmd.type === "coordination.revise"
    ) {
      const c = coordinationDoc(cmd.id, actor, h)
      assertRevision(c.revision, cmd.expectedRevision)
      if (c.state === "applied" || c.state === "declined") stale()
      const context = jointContext(c, h, actor),
        snapshot = sourceHash(c)
      if (cmd.type === "coordination.generate") {
        if (c.agreement)
          fail("AGREEMENT_EXISTS", 409, "기존 초안을 수정해 주세요.")
        const analysis = await engine.analyze(context, runOptions)
        assertSameSnapshot(actor, h)
        assertRevision(coordinationDoc(c.id, actor, h).revision, c.revision)
        const agreement = await engine.propose(
          context,
          { id: randomUUID(), revision: 1 },
          runOptions
        )
        compileChangePlan(agreement.value, context)
        return commitResult(() => {
          assertSameSnapshot(actor, h)
          const current = coordinationDoc(c.id, actor, h)
          assertRevision(current.revision, c.revision)
          if (sourceHash(current) !== snapshot) stale()
          assertCards(current, h)
          current.analysis = analysis.value
          current.analysisMetadata = analysis.metadata
          current.agreement = agreement.value
          current.agreementMetadata = agreement.metadata
          current.revision++
          current.state = "open"
          delete current.plan
          delete current.planData
          put("coordination", h.id, current)
          return current.id
        })
      }
      if (!c.agreement || !c.agreementMetadata)
        fail("AGREEMENT_REQUIRED", 422, "합의 초안을 먼저 만들어 주세요.")
      const agreement = await engine.revise(
        context,
        {
          draft: c.agreement!,
          metadata: c.agreementMetadata!,
          contentHash: hash(c.agreement),
          latestRevision: c.agreement!.revision,
        },
        { actorId: actor.id, instruction: cmd.instruction, action: cmd.action },
        runOptions
      )
      return commitResult(() => {
        assertSameSnapshot(actor, h)
        const current = coordinationDoc(c.id, actor, h)
        assertRevision(current.revision, c.revision)
        if (sourceHash(current) !== snapshot) stale()
        assertCards(current, h)
        current.agreement = agreement.value
        current.agreementMetadata = agreement.metadata
        current.revision++
        current.state =
          agreement.value.status === "draft" ? "open" : agreement.value.status
        delete current.plan
        delete current.planData
        put("coordination", h.id, current)
        return current.id
      })
    }
    if (cmd.type === "plan.resolve")
      return commitResult(() => {
        const c = coordinationDoc(cmd.id, actor, h)
        assertRevision(c.revision, cmd.expectedRevision)
        if (
          c.state !== "open" ||
          !c.agreement ||
          c.agreement.status !== "draft" ||
          !c.agreementMetadata
        )
          fail(
            "AGREEMENT_REQUIRED",
            422,
            "현재 합의 초안을 먼저 확인해 주세요."
          )
        assertCards(c, h)
        assertAgreementSources(c, h)
        if (
          Date.parse(c.agreementMetadata!.validUntil) <= Date.parse(timestamp())
        )
          stale()
        assertMembers(h, cmd.participantIds)
        assertRange(cmd.start, cmd.end)
        const target = scheduleDoc(cmd.targetId, h)
        const requiredAcceptors = sorted([
          ...new Set([
            ...c.audience,
            ...c.agreement!.parties,
            ...target.participantIds,
            ...cmd.participantIds,
          ]),
        ])
        if (requiredAcceptors.some((id) => !c.audience.includes(id)))
          fail(
            "AUDIENCE_CHANGE",
            422,
            "일정의 모든 당사자가 이 조율에 참여해야 해요."
          )
        assertNoConflict(
          h,
          cmd.start,
          cmd.end,
          cmd.participantIds,
          cmd.targetId
        )
        const compiled = compileChangePlan(
          c.agreement!,
          jointContext(c, h, actor)
        )
        const planId = c.plan?.id ?? randomUUID(),
          revision = (c.plan?.revision ?? 0) + 1
        const expiresAt = c.agreementMetadata!.validUntil
        const exact = {
          id: planId,
          revision,
          householdId: h.id,
          coordinationId: c.id,
          agreementId: c.agreement!.id,
          agreementRevision: c.agreement!.revision,
          originSemanticHash: compiled.semanticHash,
          sourceVersions: c.agreementMetadata!.sourceVersions,
          sourceHash: sourceHash(c),
          permissionEpoch: c.permissionEpoch,
          title: cmd.title,
          start: cmd.start,
          end: cmd.end,
          participantIds: sorted(cmd.participantIds),
          targetId: target.id,
          targetRevision: target.revision,
          requiredAcceptors,
          timezone: "Asia/Seoul",
          recurrence: "none",
          reminders: [],
          expiresAt,
          validatorVersion: "schedule-update-1",
        }
        c.plan = {
          id: planId,
          revision,
          digest: hash(exact),
          agreementId: exact.agreementId,
          agreementRevision: exact.agreementRevision,
          title: exact.title,
          start: exact.start,
          end: exact.end,
          participantIds: exact.participantIds,
          targetId: exact.targetId,
          targetRevision: exact.targetRevision,
          requiredAcceptors,
          acceptedBy: [],
          status: "awaiting_acceptance",
          blockers: [],
        }
        c.planData = {
          sourceHash: exact.sourceHash,
          expiresAt,
          originSemanticHash: compiled.semanticHash,
          acceptances: [],
        }
        c.revision++
        put("coordination", h.id, c)
        return c.id
      })
    if (cmd.type === "plan.accept" || cmd.type === "plan.apply")
      return commitResult(() => {
        const c = coordinationDoc(cmd.id, actor, h)
        // A second apply for the exact already-applied plan is safe even with an old coordination revision.
        if (
          cmd.type === "plan.apply" &&
          c.plan?.status === "applied" &&
          c.plan.id === cmd.planId &&
          c.plan.revision === cmd.planRevision &&
          c.plan.digest === cmd.digest
        )
          return c.plan.appliedScheduleId
        assertRevision(c.revision, cmd.expectedRevision)
        const { p, data, target } = livePlan(c, h)
        if (
          p.id !== cmd.planId ||
          p.revision !== cmd.planRevision ||
          p.digest !== cmd.digest
        )
          stale()
        if (!p.requiredAcceptors.includes(actor.id)) forbidden()
        if (cmd.type === "plan.accept") {
          if (
            !data.acceptances.some(
              (a) => a.actorId === actor.id && a.digest === p.digest
            )
          )
            data.acceptances.push({
              actorId: actor.id,
              digest: p.digest,
              at: timestamp(),
            })
          p.acceptedBy = sorted(
            data.acceptances
              .filter((a) => a.digest === p.digest)
              .map((a) => a.actorId)
          )
          p.status = p.requiredAcceptors.every((id) =>
            p.acceptedBy.includes(id)
          )
            ? "accepted"
            : "awaiting_acceptance"
          c.revision++
          put("coordination", h.id, c)
          return c.id
        }
        if (
          !p.requiredAcceptors.every((id) =>
            data.acceptances.some(
              (a) => a.actorId === id && a.digest === p.digest
            )
          )
        )
          fail(
            "ACCEPTANCE_REQUIRED",
            409,
            "모든 당사자가 같은 내용을 수락해야 반영할 수 있어요."
          )
        // BEGIN IMMEDIATE covers latest conflict query and write, including ordinary schedule.create.
        const updated: Schedule = {
          ...target,
          revision: target.revision + 1,
          title: p.title,
          start: p.start,
          end: p.end,
          participantIds: [...p.participantIds],
          originPlanId: p.id,
        }
        put("schedule", h.id, updated)
        bumpHousehold(h)
        p.status = "applied"
        p.appliedScheduleId = updated.id
        c.state = "applied"
        c.revision++
        put("coordination", h.id, c)
        notify(h, p.requiredAcceptors, c.id, "schedule_applied")
        return updated.id
      })
    return fail("INPUT_INVALID", 422, "지원하지 않는 요청이에요.")
  }

  async function command(actor: Actor, input: Command): Promise<CommandResult> {
    const parsed = Command.safeParse(input)
    if (!parsed.success)
      fail("INPUT_INVALID", 422, "입력 내용을 확인해 주세요.")
    const cmd = parsed.data!,
      payloadHash = hash(cmd)
    const receipt = transaction(() => {
      const previous = db
        .prepare(
          "SELECT payload_hash,result FROM requests WHERE actor_id=? AND request_id=?"
        )
        .get(actor.id, cmd.requestId) as
        { payload_hash: string; result: string } | undefined
      if (previous) {
        if (previous.payload_hash !== payloadHash)
          fail(
            "IDEMPOTENCY_CONFLICT",
            409,
            "같은 요청 번호로 다른 내용을 보낼 수 없어요."
          )
        return JSON.parse(previous.result) as Receipt
      }
      db.prepare(
        "INSERT INTO requests(actor_id,request_id,payload_hash,result) VALUES(?,?,?,?)"
      ).run(
        actor.id,
        cmd.requestId,
        payloadHash,
        JSON.stringify({ state: "pending" })
      )
      return undefined
    })
    if (receipt) {
      if (receipt.state === "pending")
        fail(
          "REQUEST_IN_PROGRESS",
          409,
          "처리 중인 요청이에요. 잠시 후 다시 확인해 주세요."
        )
      if (receipt.state === "failed")
        fail(
          receipt.code ?? "REQUEST_FAILED",
          receipt.status ?? 503,
          receipt.message ?? "요청을 완료하지 못했어요."
        )
      return {
        view: read(actor),
        ...(receipt.createdId ? { createdId: receipt.createdId } : {}),
      }
    }
    try {
      const createdId = await execute(actor, cmd)
      db.prepare(
        "UPDATE requests SET result=? WHERE actor_id=? AND request_id=?"
      ).run(
        JSON.stringify({ state: "done", createdId }),
        actor.id,
        cmd.requestId
      )
      return { view: read(actor), ...(createdId ? { createdId } : {}) }
    } catch (error) {
      const mapped =
        error instanceof HostError
          ? error
          : error instanceof RelationshipError
            ? new HostError(
                error.providerDetails?.status === 401 ||
                  error.providerDetails?.status === 403
                  ? "PROVIDER_AUTH"
                  : error.code,
                error.code === "RATE_LIMIT" || error.code === "BUDGET_EXCEEDED"
                  ? 429
                  : error.code === "STALE_CONTEXT"
                    ? 409
                    : 503,
                error.providerDetails?.status === 401 ||
                  error.providerDetails?.status === 403
                  ? "AI 연결을 확인해야 해요. 잠시 후 다시 시도해 주세요."
                  : error.code === "POLICY_RESTRICTED"
                    ? "이 요청은 현재 전달할 수 없어요. 개인 공간에서 내용을 확인해 주세요."
                    : error.code === "BUDGET_EXCEEDED"
                      ? "사용 가능한 AI 요청 한도에 도달했어요."
                      : "AI 정리를 완료하지 못했어요. 입력을 확인하고 다시 시도해 주세요."
              )
            : new HostError(
                "INTERNAL_ERROR",
                503,
                "요청을 완료하지 못했어요. 잠시 후 다시 시도해 주세요."
              )
      db.prepare(
        "UPDATE requests SET result=? WHERE actor_id=? AND request_id=?"
      ).run(
        JSON.stringify({
          state: "failed",
          code: mapped.code,
          status: mapped.status,
          message: mapped.message,
        }),
        actor.id,
        cmd.requestId
      )
      throw mapped
    }
  }
  return { read, command }
}
