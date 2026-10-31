"use client"

import * as React from "react"

import { timeToMinutes } from "@/lib/calendar/date"
import type { CalendarEvent, DateKey } from "@/lib/calendar/types"

/** 수정 가능한 필드(id·작성자·seed·revision 제외) */
export type CalendarEventFields = Omit<CalendarEvent, "id" | "createdByMemberId" | "seed" | "revision">

/**
 * 일정 상태의 공통 모양. 데모(메모리)와 라이브(서버) provider가 같은 인터페이스를 제공한다.
 * 변경 함수는 성공 여부를 비동기로 돌려준다. 실패 문구는 `error`에 남는다.
 */
export type CalendarContextValue = {
  /** 표시 시간대. 가족 설정이 생기면 그 값을 쓰고, 지금은 기본값 */
  timeZone: string
  today: DateKey
  events: CalendarEvent[]
  eventsOn: (date: DateKey) => CalendarEvent[]
  eventById: (id: string) => CalendarEvent | undefined
  countsByDate: Map<DateKey, number>
  add: (event: CalendarEvent, token: string) => Promise<boolean>
  update: (id: string, fields: CalendarEventFields) => Promise<boolean>
  remove: (id: string) => Promise<boolean>
  /** 서버 조회 중(라이브). 데모는 항상 false */
  loading: boolean
  /** 마지막 조회·변경 실패 문구 */
  error: string | null
  refresh: () => Promise<boolean>
}

export const CalendarContext = React.createContext<CalendarContextValue | null>(null)

export function useCalendar() {
  const ctx = React.useContext(CalendarContext)
  if (!ctx) throw new Error("useCalendar는 CalendarProvider 안에서만 쓸 수 있어요.")
  return ctx
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
