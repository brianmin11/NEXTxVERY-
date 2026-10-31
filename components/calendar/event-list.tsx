"use client"

import Link from "next/link"
import { CalendarPlus, Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ListRow, RowList } from "@/components/woorijip/list-row"
import { EmptyState } from "@/components/woorijip/state-views"
import { formatEventTime } from "@/lib/calendar/date"
import { CALENDAR_CATEGORY_LABEL, type CalendarEvent, type DateKey } from "@/lib/calendar/types"
import { findMember, type Family } from "@/lib/home.fixture"

type EventListProps = {
  events: CalendarEvent[]
  family: Family
  /** 추가 링크에 넣을 선택 날짜 */
  date: DateKey
  onOpen: (id: string, origin: HTMLElement) => void
}

/** 선택한 날짜의 일정(Figma 행 목록). 비어 있으면 추가 링크가 있는 빈 상태. */
export function EventList({ events, family, date, onOpen }: EventListProps) {
  const newHref = `/calendar/new?date=${date}`
  if (events.length === 0) {
    return (
      <EmptyState
        icon={CalendarPlus}
        title="아직 일정이 없어요"
        description="이 날의 첫 일정을 추가해 보세요."
        action={
          <Button asChild>
            <Link href={newHref}>
              <CalendarPlus aria-hidden="true" />
              일정 추가
            </Link>
          </Button>
        }
      />
    )
  }
  return (
    <div className="flex flex-col">
      <RowList>
        {events.map((ev) => {
          const names = ev.participantIds.map((id) => findMember(family, id)?.name).filter(Boolean)
          return (
            <ListRow
              key={ev.id}
              onClick={(e) => onOpen(ev.id, e.currentTarget)}
              className="min-h-20 items-start"
              leading={<span aria-hidden="true" className="mt-1 block h-12 w-1 rounded-full bg-deco-sage" />}
              title={ev.title}
              subtitle={
                <span className="tabular-nums">
                  {formatEventTime(ev)} · {ev.location || "장소 없음"}
                </span>
              }
              extra={
                <>
                  <Badge variant="outline" className="h-5 px-1.5 text-muted-foreground">
                    {CALENDAR_CATEGORY_LABEL[ev.category]}
                  </Badge>
                  {names.length > 0 && (
                    <span className="rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium text-primary">{names.join(", ")}</span>
                  )}
                </>
              }
              chevron
            />
          )
        })}
      </RowList>
      <Button variant="ghost" className="h-12 w-full text-primary" asChild>
        <Link href={newHref}>
          <Plus aria-hidden="true" />
          일정 추가
        </Link>
      </Button>
    </div>
  )
}
