"use client"

import { IS_DEMO } from "@/lib/app-mode"
import { LiveCalendarProvider } from "@/src/features/live/calendar-provider"

import { MemoryCalendarProvider } from "./memory-calendar-provider"

export { sortEvents, useCalendar } from "./calendar-context"
export type { CalendarContextValue, CalendarEventFields } from "./calendar-context"

/** 일정 provider. 라이브(서버 `/api/v2/calendar/events`)가 기본이고 데모 모드에서만 메모리 상태를 쓴다. */
export function CalendarProvider({ children, seeded = true }: { children: React.ReactNode; seeded?: boolean }) {
  return IS_DEMO ? <MemoryCalendarProvider seeded={seeded}>{children}</MemoryCalendarProvider> : <LiveCalendarProvider>{children}</LiveCalendarProvider>
}
