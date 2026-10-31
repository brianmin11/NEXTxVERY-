"use client"

import { IS_DEMO } from "@/lib/app-mode"

import { DemoFamilyProvider } from "./demo-family-provider"
import { LiveFamilyProvider } from "./live-session"

export { useFamily, useOnboarding, useOptionalFamily } from "./family-context"
export type { FamilyContextValue, NewMemberInput, OnboardingContextValue } from "./family-context"

/**
 * 가족·현재 사용자·권한·캐릭터·테마의 원본 provider. 모드에 따라 구현만 바뀐다.
 * - live(기본): Better Auth 세션 + `/api/v2` (components/family/live-session.tsx)
 * - demo(`NEXT_PUBLIC_APP_MODE=demo`): 메모리 상태 (components/family/demo-family-provider.tsx)
 */
export function FamilyProvider({ children }: { children: React.ReactNode }) {
  return IS_DEMO ? <DemoFamilyProvider>{children}</DemoFamilyProvider> : <LiveFamilyProvider>{children}</LiveFamilyProvider>
}
