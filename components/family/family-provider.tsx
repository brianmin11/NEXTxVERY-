"use client"

import * as React from "react"

import type { CharacterConfig } from "@/lib/character/catalog"
import { canChangeTheme, canEditMember, canRenameFamily } from "@/lib/family/permissions"
import { findMember, isFamilyAdmin, type Family, type FamilyMember } from "@/lib/family/types"
import { validateFamilyName, validateMemberName } from "@/lib/family/validate"
import { DEMO_HOME } from "@/lib/home.fixture"
import type { SceneTheme } from "@/lib/scene/themes"
import { clampSpot, defaultSpot, type SceneSpot } from "@/lib/scene/spots"

type FamilyContextValue = {
  family: Family
  viewer: FamilyMember
  viewerId: string
  /** 현재 인물이 가족 관리자인지(프론트 데모 규칙) */
  isAdmin: boolean
  /** 데모 전용 인물 전환. 로그인·인증이 아니다. */
  setViewerId: (id: string) => void
  /** 본인 캐릭터·이름만 바꾼다. 권한이 없으면 false */
  updateMyProfile: (patch: { name?: string; avatar?: CharacterConfig }) => boolean
  /** 관리자만. 테마는 가족 데이터·다른 구성원 캐릭터에 영향을 주지 않는다. */
  setTheme: (theme: SceneTheme) => boolean
  /** 관리자만 */
  renameFamily: (name: string) => boolean
  /** 마당 위 캐릭터 위치(화면 연출용 UI 상태, 가족 데이터가 아니다) */
  spotOf: (memberId: string) => SceneSpot
  moveMember: (memberId: string, spot: SceneSpot) => void
}

const FamilyContext = React.createContext<FamilyContextValue | null>(null)

type State = { family: Family; viewerId: string; spots: Record<string, SceneSpot> }
type Action =
  | { type: "viewer/set"; id: string }
  | { type: "member/update"; viewerId: string; patch: { name?: string; avatar?: CharacterConfig } }
  | { type: "theme/set"; viewerId: string; theme: SceneTheme }
  | { type: "family/rename"; viewerId: string; name: string }
  | { type: "spot/move"; memberId: string; spot: SceneSpot }

// 변경 함수는 UI와 같은 권한 함수를 다시 확인한다. 서버 검증을 대신하지 않는다.
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "viewer/set":
      return findMember(state.family, action.id) ? { ...state, viewerId: action.id } : state
    case "member/update": {
      if (!canEditMember(state.family, action.viewerId, action.viewerId)) return state
      const name = action.patch.name?.trim()
      if (name !== undefined && validateMemberName(name)) return state
      return {
        ...state,
        family: {
          ...state.family,
          members: state.family.members.map((m) =>
            m.id === action.viewerId ? { ...m, ...(name !== undefined ? { name } : {}), ...(action.patch.avatar ? { avatar: action.patch.avatar } : {}) } : m
          ),
        },
      }
    }
    case "theme/set":
      if (!canChangeTheme(state.family, action.viewerId)) return state
      return { ...state, family: { ...state.family, theme: action.theme } }
    case "family/rename": {
      if (!canRenameFamily(state.family, action.viewerId)) return state
      const name = action.name.trim()
      if (validateFamilyName(name)) return state
      return { ...state, family: { ...state.family, name } }
    }
    case "spot/move":
      if (!findMember(state.family, action.memberId)) return state
      return { ...state, spots: { ...state.spots, [action.memberId]: clampSpot(action.spot) } }
  }
}

/**
 * 가족·현재 인물·관리자 권한·캐릭터·공통 테마를 담는 메모리 상태.
 * 실제 서비스에서는 세션 응답(사용자 id·가족 id)과 가족 조회 결과로 이 provider 하나만 교체한다.
 */
export function FamilyProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(
    reducer,
    null,
    (): State => ({ family: DEMO_HOME.family, viewerId: DEMO_HOME.viewerId, spots: {} })
  )
  const viewer = findMember(state.family, state.viewerId) ?? state.family.members[0]
  const viewerId = viewer.id

  const value = React.useMemo<FamilyContextValue>(
    () => ({
      family: state.family,
      viewer,
      viewerId,
      isAdmin: isFamilyAdmin(state.family, viewerId),
      setViewerId: (id) => dispatch({ type: "viewer/set", id }),
      updateMyProfile: (patch) => {
        if (!canEditMember(state.family, viewerId, viewerId)) return false
        if (patch.name !== undefined && validateMemberName(patch.name)) return false
        dispatch({ type: "member/update", viewerId, patch })
        return true
      },
      setTheme: (theme) => {
        if (!canChangeTheme(state.family, viewerId)) return false
        dispatch({ type: "theme/set", viewerId, theme })
        return true
      },
      renameFamily: (name) => {
        if (!canRenameFamily(state.family, viewerId) || validateFamilyName(name)) return false
        dispatch({ type: "family/rename", viewerId, name })
        return true
      },
      spotOf: (memberId) => {
        const saved = state.spots[memberId]
        if (saved) return saved
        const index = state.family.members.findIndex((m) => m.id === memberId)
        return defaultSpot(Math.max(0, index), state.family.members.length)
      },
      moveMember: (memberId, spot) => dispatch({ type: "spot/move", memberId, spot }),
    }),
    [state.family, state.spots, viewer, viewerId]
  )

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>
}

export function useFamily() {
  const ctx = React.useContext(FamilyContext)
  if (!ctx) throw new Error("useFamily는 FamilyProvider 안에서만 쓸 수 있어요")
  return ctx
}
