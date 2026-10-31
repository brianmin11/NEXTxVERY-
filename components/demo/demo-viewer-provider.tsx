"use client"

import * as React from "react"

import { DEMO_HOME, findMember, type Family, type FamilyMember } from "@/lib/home.fixture"

/**
 * 모든 데모 기능이 같은 '현재 인물'을 읽는다. 로그인·인증이 아니다.
 * 마음 전하기·캘린더·홈 시트가 이 값을 공유한다. 메모리 전용이라 새로고침하면 기본 인물로 돌아간다.
 */
type DemoViewerValue = {
  family: Family
  viewer: FamilyMember
  viewerId: string
  setViewerId: (id: string) => void
}

const DemoViewerContext = React.createContext<DemoViewerValue | null>(null)

export function DemoViewerProvider({ children }: { children: React.ReactNode }) {
  const family = DEMO_HOME.family
  const [viewerId, setViewerId] = React.useState(DEMO_HOME.viewerId)
  const viewer = findMember(family, viewerId) ?? family.members[0]
  const value = React.useMemo<DemoViewerValue>(
    () => ({ family, viewer, viewerId: viewer.id, setViewerId }),
    [family, viewer]
  )
  return <DemoViewerContext.Provider value={value}>{children}</DemoViewerContext.Provider>
}

export function useDemoViewer() {
  const ctx = React.useContext(DemoViewerContext)
  if (!ctx) throw new Error("useDemoViewer는 DemoViewerProvider 안에서만 쓸 수 있어요.")
  return ctx
}
