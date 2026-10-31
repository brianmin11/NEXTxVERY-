"use client"

import { IS_DEMO } from "@/lib/app-mode"
import { LiveMemoriesProvider } from "@/src/features/live/memories-provider"

import { MemoryMemoriesProvider } from "./memory-memories-provider"

export { useMemories } from "./memories-context"
export type { MemoriesContextValue } from "./memories-context"

/** 추억 사진 provider. 라이브(서버 업로드·비공개 조회)가 기본이고 데모 모드에서만 탭 안 object URL을 쓴다. */
export function MemoriesProvider({ children, seeded = true }: { children: React.ReactNode; seeded?: boolean }) {
  return IS_DEMO ? <MemoryMemoriesProvider seeded={seeded}>{children}</MemoryMemoriesProvider> : <LiveMemoriesProvider>{children}</LiveMemoriesProvider>
}
