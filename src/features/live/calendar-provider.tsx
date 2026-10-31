"use client"
import * as React from "react"
import { todayKey, timeToMinutes } from "@/lib/calendar/date"
import type { CalendarEvent } from "@/lib/calendar/types"
import { useResource, ResourceState } from "./client"
export type CalendarEventFields = Omit<
  CalendarEvent,
  "id" | "createdByMemberId" | "seed" | "revision"
>
export function sortEvents(events: CalendarEvent[]) {
  return [...events].sort(
    (a, b) =>
      Number(b.allDay) - Number(a.allDay) ||
      (a.startTime ? timeToMinutes(a.startTime) : -1) -
        (b.startTime ? timeToMinutes(b.startTime) : -1) ||
      a.title.localeCompare(b.title, "ko")
  )
}
function useValue() {
  const r = useResource<CalendarEvent[]>("calendar/events", [])
  return {
    ...r,
    timeZone: "Asia/Seoul",
    today: todayKey(),
    events: r.data,
    eventsOn: (date: string) =>
      sortEvents(r.data.filter((e) => e.date === date)),
    eventById: (id: string) => r.data.find((e) => e.id === id),
    countsByDate: new Map(
      r.data.map((e) => [
        e.date,
        r.data.filter((x) => x.date === e.date).length,
      ])
    ),
    add: async (event: CalendarEvent, token: string) =>
      !!(await r.mutate(
        "calendar/events",
        "POST",
        {
          fields: (({ id, createdByMemberId, seed, revision, ...fields }) =>
            fields)(event),
        },
        token
      )),
    update: async (id: string, fields: CalendarEventFields) =>
      !!(await r.mutate("calendar/events/" + id, "PATCH", {
        fields,
        expectedRevision: r.data.find((e) => e.id === id)?.revision,
      })),
    remove: async (id: string) =>
      !!(await r.mutate("calendar/events/" + id, "DELETE", {
        expectedRevision: r.data.find((e) => e.id === id)?.revision,
      })),
  }
}
const Context = React.createContext<ReturnType<typeof useValue> | null>(null)
export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const v = useValue()
  return (
    <Context.Provider value={v}>
      <ResourceState {...v} retry={v.refresh}>
        {children}
      </ResourceState>
    </Context.Provider>
  )
}
export function useCalendar() {
  const v = React.useContext(Context)
  if (!v) throw new Error("CalendarProvider 필요")
  return v
}
