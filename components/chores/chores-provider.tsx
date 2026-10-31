"use client"

import { IS_DEMO } from "@/lib/app-mode"
import { LiveChoresProvider } from "@/src/features/live/chores-provider"

import { MemoryChoresProvider } from "./memory-chores-provider"

export { sortDones, sortTodos, useChores } from "./chores-context"
export type { ChoreFields, ChoresContextValue } from "./chores-context"

/** 집안일 provider. 라이브(서버 `/api/v2/chores`)가 기본이고 데모 모드에서만 메모리 상태를 쓴다. */
export function ChoresProvider({ children, seeded = true }: { children: React.ReactNode; seeded?: boolean }) {
  return IS_DEMO ? <MemoryChoresProvider seeded={seeded}>{children}</MemoryChoresProvider> : <LiveChoresProvider>{children}</LiveChoresProvider>
}
