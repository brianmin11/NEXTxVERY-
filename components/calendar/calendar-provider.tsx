"use client"

import * as React from "react"

import { useDemoViewer } from "@/components/demo/demo-viewer-provider"
import { CALENDAR_DEFAULT_TIME_ZONE } from "@/lib/calendar/config"
import { isValidDateKey, timeToMinutes, todayKey as computeTodayKey } from "@/lib/calendar/date"
import { seedEvents } from "@/lib/calendar/fixture"
import type { CalendarEvent, DateKey } from "@/lib/calendar/types"

/**
 * 가족 일정 데모 상태. 메모리에만 있어 라우트 이동 중에는 유지되고 새로고침하면 초기화된다.
 * 홈 '오늘 일정'과 /calendar가 같은 원본을 읽는다. 실제 DB·외부 캘린더·알림은 없다.
 */

type State = {
  events: CalendarEvent[]
  /** 저장 연타 방지용. 같은 토큰으로는 한 번만 추가한다 */
  usedTokens: string[]
}

/** 수정 가능한 필드(id·작성자·seed 제외) */
export type CalendarEventFields = Omit<CalendarEvent, "id" | "createdByMemberId" | "seed">

type Action =
  | { type: "add"; event: CalendarEvent; token: string }
  | { type: "update"; id: string; fields: CalendarEventFields }
  | { type: "remove"; id: string }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "add":
      if (state.usedTokens.includes(action.token) || state.events.some((e) => e.id === action.event.id)) return state
      return { events: [...state.events, action.event], usedTokens: [...state.usedTokens, action.token] }
    case "update":
      return {
        ...state,
        events: state.events.map((e) => (e.id === action.id ? { ...e, ...action.fields, seed: undefined } : e)),
      }
    case "remove":
      return { ...state, events: state.events.filter((e) => e.id !== action.id) }
  }
}

/** 같은 날 안의 정렬: 종일 → 시작 시간 → 제목 */
export function sortEvents(events: CalendarEvent[]) {
  return [...events].sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
    const am = a.startTime ? timeToMinutes(a.startTime) : -1
    const bm = b.startTime ? timeToMinutes(b.startTime) : -1
    if (am !== bm) return am - bm
    return a.title.localeCompare(b.title, "ko")
  })
}

// 오늘 날짜. 개발 환경에서는 ?today=YYYY-MM-DD로 고정해 월말·연말을 검증할 수 있다.
const subscribeNoop = () => () => {}
function readToday() {
  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
    const override = new URLSearchParams(window.location.search).get("today")
    if (override && isValidDateKey(override)) return override
  }
  return computeTodayKey(new Date(), CALENDAR_DEFAULT_TIME_ZONE)
}
function readTodayServer() {
  return computeTodayKey(new Date(), CALENDAR_DEFAULT_TIME_ZONE)
}

type CalendarContextValue = {
  /** 표시 시간대. 가족 설정이 생기면 그 값을 쓰고, 지금은 데모 기본값 */
  timeZone: string
  today: DateKey
  events: CalendarEvent[]
  eventsOn: (date: DateKey) => CalendarEvent[]
  eventById: (id: string) => CalendarEvent | undefined
  countsByDate: Map<DateKey, number>
  add: (event: CalendarEvent, token: string) => void
  update: (id: string, fields: CalendarEventFields) => void
  remove: (id: string) => void
}

const CalendarContext = React.createContext<CalendarContextValue | null>(null)

export function CalendarProvider({ children, seeded = true }: { children: React.ReactNode; seeded?: boolean }) {
  const { family } = useDemoViewer()
  const today = React.useSyncExternalStore(subscribeNoop, readToday, readTodayServer)
  // seed는 마운트 때 한 번만 만든다. 라우트 이동으로 다시 초기화되지 않는다.
  const [state, dispatch] = React.useReducer(reducer, null, () => ({
    events: seeded ? seedEvents(readTodayServer(), family.members.map((m) => m.id)) : [],
    usedTokens: [],
  }))

  const countsByDate = new Map<DateKey, number>()
  for (const e of state.events) countsByDate.set(e.date, (countsByDate.get(e.date) ?? 0) + 1)

  const value: CalendarContextValue = {
    timeZone: CALENDAR_DEFAULT_TIME_ZONE,
    today,
    events: state.events,
    eventsOn: (date) => sortEvents(state.events.filter((e) => e.date === date)),
    eventById: (id) => state.events.find((e) => e.id === id),
    countsByDate,
    add: (event, token) => dispatch({ type: "add", event, token }),
    update: (id, fields) => dispatch({ type: "update", id, fields }),
    remove: (id) => dispatch({ type: "remove", id }),
  }
  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>
}

export function useCalendar() {
  const ctx = React.useContext(CalendarContext)
  if (!ctx) throw new Error("useCalendar는 CalendarProvider 안에서만 쓸 수 있어요.")
  return ctx
}
