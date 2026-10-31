"use client"

import * as React from "react"

import { useFamily } from "@/components/family/family-context"
import { CALENDAR_DEFAULT_TIME_ZONE } from "@/lib/calendar/config"
import { isValidDateKey, todayKey as computeTodayKey } from "@/lib/calendar/date"
import { seedEvents } from "@/lib/calendar/fixture"
import type { CalendarEvent, DateKey } from "@/lib/calendar/types"

import { CalendarContext, sortEvents, type CalendarContextValue, type CalendarEventFields } from "./calendar-context"

/**
 * 가족 일정 데모 상태(메모리). 라우트 이동 중에는 유지되고 새로고침하면 초기화된다.
 * 홈 '오늘 일정'과 /calendar가 같은 원본을 읽는다. 실제 DB·외부 캘린더·알림은 없다.
 */

type State = {
  events: CalendarEvent[]
  /** 저장 연타 방지용. 같은 토큰으로는 한 번만 추가한다 */
  usedTokens: string[]
}

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

export function MemoryCalendarProvider({ children, seeded = true }: { children: React.ReactNode; seeded?: boolean }) {
  const { family } = useFamily()
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
    add: async (event, token) => {
      dispatch({ type: "add", event, token })
      return true
    },
    update: async (id, fields) => {
      dispatch({ type: "update", id, fields })
      return true
    },
    remove: async (id) => {
      dispatch({ type: "remove", id })
      return true
    },
    loading: false,
    error: null,
    refresh: async () => true,
  }
  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>
}
