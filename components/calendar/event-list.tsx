"use client"

import { CalendarPlus, ChevronRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { MemberStack } from "@/components/woorijip/member"
import { EmptyState } from "@/components/woorijip/state-views"
import { formatEventTime } from "@/lib/calendar/date"
import { CALENDAR_CATEGORY_LABEL, type CalendarEvent } from "@/lib/calendar/types"
import { findMember, type Family } from "@/lib/home.fixture"

type EventListProps = {
  events: CalendarEvent[]
  family: Family
  onOpen: (id: string, origin: HTMLElement) => void
  onAdd: (origin: HTMLElement) => void
}

/** 선택한 날짜의 일정. 비어 있으면 추가 버튼이 있는 빈 상태. */
export function EventList({ events, family, onOpen, onAdd }: EventListProps) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={CalendarPlus}
        title="아직 일정이 없어요"
        description="이 날의 첫 일정을 추가해 보세요."
        action={
          <Button onClick={(e) => onAdd(e.currentTarget)}>
            <CalendarPlus aria-hidden="true" />
            일정 추가
          </Button>
        }
      />
    )
  }
  return (
    <Card size="sm" className="gap-0 py-0">
      <ul>
        {events.map((ev, i) => {
          const members = ev.participantIds.map((id) => findMember(family, id)).filter((m) => m !== undefined)
          return (
            <li key={ev.id}>
              {i > 0 && <Separator />}
              <Button
                variant="ghost"
                className="h-auto w-full items-start justify-start gap-3 rounded-none px-4 py-3 text-left whitespace-normal"
                onClick={(e) => onOpen(ev.id, e.currentTarget)}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-sm text-muted-foreground tabular-nums">{formatEventTime(ev)}</span>
                  <span className="font-semibold">{ev.title}</span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="h-5 px-1.5 text-muted-foreground">
                      {CALENDAR_CATEGORY_LABEL[ev.category]}
                    </Badge>
                    {members.length > 0 && <MemberStack members={members} max={3} />}
                  </span>
                </span>
                <ChevronRight className="mt-1 text-muted-foreground" aria-hidden="true" />
              </Button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
