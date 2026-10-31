"use client"

import * as React from "react"

import { CalendarContext, sortEvents, type CalendarContextValue, type CalendarEventFields } from "@/components/calendar/calendar-context"
import { CALENDAR_DEFAULT_TIME_ZONE } from "@/lib/calendar/config"
import { todayKey } from "@/lib/calendar/date"
import type { CalendarEvent, DateKey } from "@/lib/calendar/types"

import { ResourceState, useResource } from "./client"

/**
 * 라이브 일정 provider: `GET/POST /api/v2/calendar/events`, `PATCH/DELETE /api/v2/calendar/events/:id`.
 * 날짜·시간은 `YYYY-MM-DD`/`HH:mm` 문자열 그대로 보내고 받는다(UTC 변환 없음).
 * 수정·삭제는 `expectedRevision`을 함께 보내 다른 기기의 변경과 충돌하면 409로 거부된다.
 */
export function LiveCalendarProvider({ children }: { children: React.ReactNode }) {
  const r = useResource<CalendarEvent[]>("calendar/events", [])
  const events = r.data
  const countsByDate = new Map<DateKey, number>()
  for (const e of events) countsByDate.set(e.date, (countsByDate.get(e.date) ?? 0) + 1)

  const value: CalendarContextValue = {
    timeZone: CALENDAR_DEFAULT_TIME_ZONE,
    today: todayKey(),
    events,
    eventsOn: (date) => sortEvents(events.filter((e) => e.date === date)),
    eventById: (id) => events.find((e) => e.id === id),
    countsByDate,
    add: async (event, token) => {
      const fields: CalendarEventFields = {
        title: event.title,
        category: event.category,
        date: event.date,
        allDay: event.allDay,
        startTime: event.startTime,
        endTime: event.endTime,
        location: event.location,
        memo: event.memo,
        participantIds: event.participantIds,
      }
      return !!(await r.mutate("calendar/events", "POST", { fields }, token))
    },
    update: async (id, fields) =>
      !!(await r.mutate(`calendar/events/${id}`, "PATCH", { fields, expectedRevision: events.find((e) => e.id === id)?.revision })),
    remove: async (id) => !!(await r.mutate(`calendar/events/${id}`, "DELETE", { expectedRevision: events.find((e) => e.id === id)?.revision })),
    loading: r.loading,
    error: r.error || null,
    refresh: r.refresh,
  }
  return (
    <CalendarContext.Provider value={value}>
      <ResourceState loading={r.loading} error={r.error} busy={r.busy} retry={r.refresh}>
        {children}
      </ResourceState>
    </CalendarContext.Provider>
  )
}
