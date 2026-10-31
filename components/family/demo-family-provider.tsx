"use client"

import * as React from "react"

import type { MemberTone } from "@/components/woorijip/member"
import type { CharacterConfig } from "@/lib/character/catalog"
import { generateInviteCode } from "@/lib/family/invite"
import { createDemoInviteAdapter, DEMO_EXPIRED_CODE, type InviteLookup } from "@/lib/family/invite-adapter"
import { canChangeTheme, canEditMember, canInvite, canRenameFamily } from "@/lib/family/permissions"
import { findMember, isFamilyAdmin, type Family, type FamilyMember } from "@/lib/family/types"
import { normalizeInviteCode, validateFamilyName, validateMemberName } from "@/lib/family/validate"
import { DEMO_HOME } from "@/lib/home.fixture"
import { DEFAULT_THEME, type SceneTheme } from "@/lib/scene/themes"
import { clampSpot, defaultSpot, type SceneSpot } from "@/lib/scene/spots"

import { FamilyContext, OnboardingContext, type FamilyContextValue, type NewMemberInput, type OnboardingContextValue } from "./family-context"

type Session = { familyId: string; memberId: string }
type State = {
  families: Record<string, Family>
  order: string[]
  session: Session
  lastMember: Record<string, string>
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
 * 데모 모드(메모리) 가족 상태. 가족 목록·세션(가족 id + 구성원 id)·관리자·캐릭터·테마·위치를 담는다.
 * 가족을 만들거나 참여하면 세션이 그 가족으로 바뀌고 FamilyScope가 가족 id로 다시 마운트된다. 새로고침하면 초기화된다.
 */
export function DemoFamilyProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(reducer, null, initialState)
  const family = current(state)
  const viewer = findMember(family, state.session.memberId) ?? family.members[0]
  const viewerId = viewer.id

  const findByCode = React.useCallback(
    (raw: string): InviteLookup => {
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
    },
    [state.order, state.families, family.id]
  )

  const onboarding = React.useMemo<OnboardingContextValue>(
    () => ({
      mode: "demo",
      currentFamily: family,
      supportsLookup: true,
      inviteAdapter: createDemoInviteAdapter(findByCode),
      demoCodes: state.order
        .map((id) => state.families[id])
        .filter((f) => f.id !== family.id && f.inviteCode)
        .map((f) => ({ code: f.inviteCode as string, name: f.name })),
      lastError: null,
      createFamily: async (name, input) => {
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
      joinFamily: async (code, input) => {
        const found = findByCode(code)
        if (found.status !== "ok" || validateMemberName(input.name)) return null
        const target = state.families[found.family.id]
        const member = newMember(input, target.members.length)
        dispatch({ type: "family/join", familyId: target.id, member })
        return { familyId: target.id, memberId: member.id }
      },
    }),
    [family, findByCode, state.order, state.families]
  )

  const value = React.useMemo<FamilyContextValue>(
    () => ({
      mode: "demo",
      family,
      viewer,
      viewerId,
      isAdmin: isFamilyAdmin(family, viewerId),
      families: state.order.map((id) => state.families[id]),
      lastError: null,
      setViewerId: (id) => dispatch({ type: "viewer/set", id }),
      switchFamily: (familyId) => {
        if (!state.families[familyId]) return false
        dispatch({ type: "family/switch", familyId })
        return true
      },
      updateMyProfile: async (patch) => {
        if (!canEditMember(family, viewerId, viewerId)) return false
        if (patch.name !== undefined && validateMemberName(patch.name)) return false
        dispatch({ type: "member/update", patch })
        return true
      },
      setTheme: async (theme) => {
        if (!canChangeTheme(family, viewerId)) return false
        dispatch({ type: "theme/set", theme })
        return true
      },
      renameFamily: async (name) => {
        if (!canRenameFamily(family, viewerId) || validateFamilyName(name)) return false
        dispatch({ type: "family/rename", name })
        return true
      },
      createInvite: async () => {
        if (!canInvite(family, viewerId) || !family.inviteCode) return null
        return { inviteCode: family.inviteCode, expiresAt: null }
      },
      spotOf: (memberId) => {
        const saved = state.spots[family.id]?.[memberId]
        if (saved) return saved
        const index = family.members.findIndex((m) => m.id === memberId)
        return defaultSpot(Math.max(0, index), family.members.length)
      },
      moveMember: (memberId, spot) => dispatch({ type: "spot/move", memberId, spot }),
    }),
    [family, state.families, state.order, state.spots, viewer, viewerId]
  )

  return (
    <OnboardingContext.Provider value={onboarding}>
      <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>
    </OnboardingContext.Provider>
  )
}
