"use client"

import * as React from "react"

import type { MemberTone } from "@/components/woorijip/member"
import type { CharacterConfig } from "@/lib/character/catalog"
import { generateInviteCode } from "@/lib/family/invite"
import { createDemoInviteAdapter, DEMO_EXPIRED_CODE, type InviteAdapter, type InviteLookup } from "@/lib/family/invite-adapter"
import { canChangeTheme, canEditMember, canRenameFamily } from "@/lib/family/permissions"
import { findMember, isFamilyAdmin, type Family, type FamilyMember } from "@/lib/family/types"
import { normalizeInviteCode, validateFamilyName, validateMemberName } from "@/lib/family/validate"
import { DEMO_FAMILY_FOUR, DEMO_HOME } from "@/lib/home.fixture"
import { DEFAULT_THEME, type SceneTheme } from "@/lib/scene/themes"
import { clampSpot, defaultSpot, type SceneSpot } from "@/lib/scene/spots"

export type NewMemberInput = { name: string; avatar: CharacterConfig }

type FamilyContextValue = {
  family: Family
  viewer: FamilyMember
  viewerId: string
  /** 현재 인물이 가족 관리자인지(프론트 데모 규칙) */
  isAdmin: boolean
  /** 이 세션(탭)에서 만들었거나 참여한 가족 목록. 데모 전환 컨트롤 전용 */
  families: Family[]
  /** 데모 전용 인물 전환. 로그인·인증이 아니다. */
  setViewerId: (id: string) => void
  /** 데모 전용 가족 전환. 마지막으로 보던 인물로 돌아간다 */
  switchFamily: (familyId: string) => boolean
  /** 본인 캐릭터·이름만 바꾼다. 권한이 없으면 false */
  updateMyProfile: (patch: { name?: string; avatar?: CharacterConfig }) => boolean
  /** 관리자만. 테마는 가족 데이터·다른 구성원 캐릭터에 영향을 주지 않는다. */
  setTheme: (theme: SceneTheme) => boolean
  /** 관리자만 */
  renameFamily: (name: string) => boolean
  /** 새 가족을 만들고 만든 사람을 초기 관리자로 둔다. 바로 그 가족으로 전환된다 */
  createFamily: (name: string, member: NewMemberInput) => { familyId: string; memberId: string } | null
  /** 초대코드로 찾은 가족에 구성원으로 참여하고 그 가족으로 전환된다 */
  joinFamily: (familyId: string, member: NewMemberInput) => { familyId: string; memberId: string } | null
  /** 초대코드 조회(교체 지점). 데모에서는 메모리 가족 목록을 본다 */
  inviteAdapter: InviteAdapter
  /** 마당 위 캐릭터 위치(화면 연출용 UI 상태, 가족 데이터가 아니다) */
  spotOf: (memberId: string) => SceneSpot
  moveMember: (memberId: string, spot: SceneSpot) => void
}

const FamilyContext = React.createContext<FamilyContextValue | null>(null)

type Session = { familyId: string; memberId: string }
type State = {
  families: Record<string, Family>
  /** 가족 id 순서(만든 순) */
  order: string[]
  session: Session
  /** 가족별로 마지막에 보던 인물 */
  lastMember: Record<string, string>
  /** 가족별 캐릭터 위치 */
  spots: Record<string, Record<string, SceneSpot>>
}

type Action =
  | { type: "viewer/set"; id: string }
  | { type: "family/switch"; familyId: string }
  | { type: "member/update"; patch: { name?: string; avatar?: CharacterConfig } }
  | { type: "theme/set"; theme: SceneTheme }
  | { type: "family/rename"; name: string }
  | { type: "family/create"; family: Family; memberId: string }
  | { type: "family/join"; familyId: string; member: FamilyMember }
  | { type: "spot/move"; memberId: string; spot: SceneSpot }

const TONES: MemberTone[] = ["apricot", "sky", "butter", "sage"]

function current(state: State) {
  return state.families[state.session.familyId]
}

function patchFamily(state: State, family: Family): State {
  return { ...state, families: { ...state.families, [family.id]: family } }
}

// 변경 함수는 UI와 같은 권한 함수를 다시 확인한다. 서버 검증을 대신하지 않는다.
function reducer(state: State, action: Action): State {
  const family = current(state)
  const viewerId = state.session.memberId
  switch (action.type) {
    case "viewer/set":
      if (!findMember(family, action.id)) return state
      return { ...state, session: { ...state.session, memberId: action.id }, lastMember: { ...state.lastMember, [family.id]: action.id } }
    case "family/switch": {
      const target = state.families[action.familyId]
      if (!target) return state
      const memberId = state.lastMember[target.id] ?? target.members[0].id
      return { ...state, session: { familyId: target.id, memberId } }
    }
    case "member/update": {
      if (!canEditMember(family, viewerId, viewerId)) return state
      const name = action.patch.name?.trim()
      if (name !== undefined && validateMemberName(name)) return state
      return patchFamily(state, {
        ...family,
        members: family.members.map((m) =>
          m.id === viewerId ? { ...m, ...(name !== undefined ? { name } : {}), ...(action.patch.avatar ? { avatar: action.patch.avatar } : {}) } : m
        ),
      })
    }
    case "theme/set":
      if (!canChangeTheme(family, viewerId)) return state
      return patchFamily(state, { ...family, theme: action.theme })
    case "family/rename": {
      if (!canRenameFamily(family, viewerId)) return state
      const name = action.name.trim()
      if (validateFamilyName(name)) return state
      return patchFamily(state, { ...family, name })
    }
    case "family/create":
      if (state.families[action.family.id]) return state
      return {
        ...state,
        families: { ...state.families, [action.family.id]: action.family },
        order: [...state.order, action.family.id],
        session: { familyId: action.family.id, memberId: action.memberId },
        lastMember: { ...state.lastMember, [action.family.id]: action.memberId },
      }
    case "family/join": {
      const target = state.families[action.familyId]
      if (!target || target.members.some((m) => m.id === action.member.id)) return state
      const joined = { ...target, members: [...target.members, action.member] }
      return {
        ...state,
        families: { ...state.families, [joined.id]: joined },
        session: { familyId: joined.id, memberId: action.member.id },
        lastMember: { ...state.lastMember, [joined.id]: action.member.id },
      }
    }
    case "spot/move": {
      if (!findMember(family, action.memberId)) return state
      const forFamily = { ...(state.spots[family.id] ?? {}), [action.memberId]: clampSpot(action.spot) }
      return { ...state, spots: { ...state.spots, [family.id]: forFamily } }
    }
  }
}

function initialState(): State {
  const family = DEMO_HOME.family
  return {
    families: { [family.id]: family },
    order: [family.id],
    session: { familyId: family.id, memberId: DEMO_HOME.viewerId },
    lastMember: { [family.id]: DEMO_HOME.viewerId },
    spots: {},
  }
}

function newMember(input: NewMemberInput, index: number): FamilyMember {
  return { id: `m-${crypto.randomUUID()}`, name: input.name.trim(), tone: TONES[index % TONES.length], avatar: input.avatar }
}

/**
 * 가족 목록·현재 세션(가족 id + 구성원 id)·관리자 권한·캐릭터·공통 테마를 담는 메모리 상태.
 * 가족을 만들거나 참여하면 세션이 그 가족으로 바뀌고, 가족 단위 provider(FamilyScope)는 가족 id로 다시 마운트되어
 * 이전 가족의 일정·마음·사진·집안일이 섞이지 않는다.
 * 실제 서비스에서는 세션 응답(사용자 id·가족 id)과 가족 조회 결과로 이 provider 하나만 교체한다.
 */
export function FamilyProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(reducer, null, initialState)
  const family = current(state)
  const viewer = findMember(family, state.session.memberId) ?? family.members[0]
  const viewerId = viewer.id

  const value = React.useMemo<FamilyContextValue>(() => {
    const findByCode = (raw: string): InviteLookup => {
      const code = normalizeInviteCode(raw)
      if (code === DEMO_EXPIRED_CODE) return { status: "expired" }
      const found = state.order.map((id) => state.families[id]).find((f) => f.inviteCode === code)
      if (!found) return { status: "not-found" }
      if (found.id === family.id) return { status: "already-member" }
      const admin = findMember(found, found.adminMemberId)
      return {
        status: "ok",
        family: { id: found.id, name: found.name, adminName: admin?.name ?? "가족", members: found.members.map((m) => ({ id: m.id, name: m.name, tone: m.tone })) },
      }
    }
    return {
      family,
      viewer,
      viewerId,
      isAdmin: isFamilyAdmin(family, viewerId),
      families: state.order.map((id) => state.families[id]),
      setViewerId: (id) => dispatch({ type: "viewer/set", id }),
      switchFamily: (familyId) => {
        if (!state.families[familyId]) return false
        dispatch({ type: "family/switch", familyId })
        return true
      },
      updateMyProfile: (patch) => {
        if (!canEditMember(family, viewerId, viewerId)) return false
        if (patch.name !== undefined && validateMemberName(patch.name)) return false
        dispatch({ type: "member/update", patch })
        return true
      },
      setTheme: (theme) => {
        if (!canChangeTheme(family, viewerId)) return false
        dispatch({ type: "theme/set", theme })
        return true
      },
      renameFamily: (name) => {
        if (!canRenameFamily(family, viewerId) || validateFamilyName(name)) return false
        dispatch({ type: "family/rename", name })
        return true
      },
      createFamily: (name, input) => {
        if (validateFamilyName(name) || validateMemberName(input.name)) return null
        const member = newMember(input, 0)
        const created: Family = {
          id: `fam-${crypto.randomUUID().slice(0, 8)}`,
          name: name.trim(),
          members: [member],
          adminMemberId: member.id,
          theme: DEFAULT_THEME,
          inviteCode: generateInviteCode(),
        }
        dispatch({ type: "family/create", family: created, memberId: member.id })
        return { familyId: created.id, memberId: member.id }
      },
      joinFamily: (familyId, input) => {
        const target = state.families[familyId]
        if (!target || validateMemberName(input.name)) return null
        const member = newMember(input, target.members.length)
        dispatch({ type: "family/join", familyId, member })
        return { familyId, memberId: member.id }
      },
      inviteAdapter: createDemoInviteAdapter(findByCode),
      spotOf: (memberId) => {
        const saved = state.spots[family.id]?.[memberId]
        if (saved) return saved
        const index = family.members.findIndex((m) => m.id === memberId)
        return defaultSpot(Math.max(0, index), family.members.length)
      },
      moveMember: (memberId, spot) => dispatch({ type: "spot/move", memberId, spot }),
    }
  }, [family, state.families, state.order, state.spots, viewer, viewerId])

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>
}

export function useFamily() {
  const ctx = React.useContext(FamilyContext)
  if (!ctx) throw new Error("useFamily는 FamilyProvider 안에서만 쓸 수 있어요")
  return ctx
}

/** 데모 기본 가족인지(seed 데이터가 있는 가족) */
export function isSeedFamily(family: Family) {
  return family.seed === true && family.id === DEMO_FAMILY_FOUR.id
}
