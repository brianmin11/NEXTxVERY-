"use client"

import { IS_DEMO } from "@/lib/app-mode"
import { LiveMindProvider } from "@/src/features/live/mind-provider"

import { MemoryMindProvider } from "./memory-mind-provider"

export { useMind } from "./mind-context"
export type { MindAction, MindContextValue, SuggestionPhase } from "./mind-context"

/** 마음 전하기 provider. 라이브(서버 `/api/v2/mind/*`, 원문 비보관 AI 제안)가 기본이고 데모 모드에서만 메모리 상태를 쓴다. */
export function MindProvider({ children, seeded = true }: { children: React.ReactNode; seeded?: boolean }) {
  return IS_DEMO ? <MemoryMindProvider seeded={seeded}>{children}</MemoryMindProvider> : <LiveMindProvider>{children}</LiveMindProvider>
}
