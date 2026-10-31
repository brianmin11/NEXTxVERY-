"use client"

import * as React from "react"

import type { AppMode } from "@/lib/app-mode"
import type { CharacterConfig } from "@/lib/character/catalog"
import type { InviteAdapter } from "@/lib/family/invite-adapter"
import type { Family, FamilyMember } from "@/lib/family/types"
import type { SceneTheme } from "@/lib/scene/themes"
import type { SceneSpot } from "@/lib/scene/spots"

export type NewMemberInput = { name: string; avatar: CharacterConfig }
export type JoinResult = { familyId: string; memberId: string } | null

/**
 * 가족 안에 있을 때의 상태. 데모(메모리)와 라이브(서버 세션) provider가 같은 모양으로 제공한다.
 * 변경 함수는 모두 비동기이며 성공 여부만 돌려준다. 실패 이유는 각 provider의 `lastError`에 남는다.
 */
export type FamilyContextValue = {
  mode: AppMode
  family: Family
  viewer: FamilyMember
  viewerId: string
  /** 현재 인물이 가족 관리자인지. 라이브에서는 서버가 돌려준 adminMemberId 기준이며 서버가 다시 검증한다. */
  isAdmin: boolean
  /** 이 탭에서 만들었거나 참여한 가족 목록. 데모 전환 컨트롤 전용(라이브는 현재 가족 하나) */
  families: Family[]
  /** 데모 전용 인물 전환. 라이브에서는 아무 일도 하지 않는다. */
  setViewerId: (id: string) => void
  /** 데모 전용 가족 전환 */
  switchFamily: (familyId: string) => boolean
  /** 본인 캐릭터·이름만 바꾼다 */
  updateMyProfile: (patch: { name?: string; avatar?: CharacterConfig }) => Promise<boolean>
  /** 관리자만. 테마는 가족 데이터·다른 구성원 캐릭터에 영향을 주지 않는다. */
  setTheme: (theme: SceneTheme) => Promise<boolean>
  /** 관리자만 */
  renameFamily: (name: string) => Promise<boolean>
  /** 관리자만. 새 초대코드를 발급한다(라이브: 24시간, 데모: 고정 코드) */
  createInvite: () => Promise<{ inviteCode: string; expiresAt: string | null } | null>
  /** 라이브 전용 로그아웃. 데모에서는 undefined */
  logout?: () => Promise<void>
  /** 마지막 실패 메시지(화면에 그대로 보여 줘도 되는 문구) */
  lastError: string | null
  /** 마당 위 캐릭터 위치(화면 연출용 UI 상태, 가족 데이터가 아니다) */
  spotOf: (memberId: string) => SceneSpot
  moveMember: (memberId: string, spot: SceneSpot) => void
}

/** 가족이 없어도 쓸 수 있는 온보딩 동작. 환영·가족 만들기·초대 참여 화면이 쓴다. */
export type OnboardingContextValue = {
  mode: AppMode
  /** 현재 들어가 있는 가족(없으면 null) */
  currentFamily: Family | null
  /** 새 가족을 만들고 만든 사람을 초기 관리자로 둔다. 성공하면 그 가족으로 들어간다 */
  createFamily: (name: string, member: NewMemberInput) => Promise<JoinResult>
  /** 초대코드로 참여하고 내 이름·캐릭터를 저장한다 */
  joinFamily: (inviteCode: string, member: NewMemberInput) => Promise<JoinResult>
  /** 코드 미리 조회(데모만 지원). 라이브는 `supportsLookup=false`이며 참여 요청으로만 검증한다 */
  inviteAdapter: InviteAdapter
  supportsLookup: boolean
  /** 데모에서 바로 써 볼 수 있는 코드 목록(라이브는 빈 배열) */
  demoCodes: { code: string; name: string }[]
  logout?: () => Promise<void>
  lastError: string | null
}

export const FamilyContext = React.createContext<FamilyContextValue | null>(null)
export const OnboardingContext = React.createContext<OnboardingContextValue | null>(null)

export function useFamily() {
  const ctx = React.useContext(FamilyContext)
  if (!ctx) throw new Error("useFamily는 가족에 들어간 뒤(FamilyScope 안)에서만 쓸 수 있어요")
  return ctx
}

/** 가족 밖(온보딩·로그인)에서도 안전하게 읽는다 */
export function useOptionalFamily() {
  return React.useContext(FamilyContext)
}

export function useOnboarding() {
  const ctx = React.useContext(OnboardingContext)
  if (!ctx) throw new Error("useOnboarding은 FamilyProvider 안에서만 쓸 수 있어요")
  return ctx
}
