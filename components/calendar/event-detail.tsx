"use client"

import { CalendarDays, Clock, MapPin, Pencil, StickyNote, Trash2, User } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { MemberChip } from "@/components/woorijip/member"
import { formatDateKeyFull, formatEventTime } from "@/lib/calendar/date"
import { CALENDAR_CATEGORY_LABEL, type CalendarEvent } from "@/lib/calendar/types"
import { findMember, type Family } from "@/lib/home.fixture"

type EventDetailProps = {
  event: CalendarEvent
  family: Family
  viewerId: string
  onEdit: () => void
  onDelete: () => void
}

/** 일정 상세(Figma: 유형 칩 → 제목 → 날짜 → 정보 행). 작성자(데모 인물 기준)에게만 수정·삭제를 보여준다. 서버 권한 검증이 아니다. */
export function EventDetail({ event, family, viewerId, onEdit, onDelete }: EventDetailProps) {
  const creator = findMember(family, event.createdByMemberId)
  const members = event.participantIds.map((id) => findMember(family, id)).filter((m) => m !== undefined)
  const canEdit = event.createdByMemberId === viewerId

  return (
    <>
      <SheetHeader className="px-5 pt-2">
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-bold text-primary">{CALENDAR_CATEGORY_LABEL[event.category]}</span>
          {event.seed && (
            <Badge variant="outline" className="h-5 px-2 text-muted-foreground">
              데모 예시
            </Badge>
          )}
        </div>
        <SheetTitle className="pr-10 text-2xl font-bold tracking-tight">{event.title}</SheetTitle>
        <SheetDescription className="tabular-nums">
          <time dateTime={event.date}>{formatDateKeyFull(event.date)}</time>
          {" · "}
          {formatEventTime(event)}
        </SheetDescription>
      </SheetHeader>
      <dl className="flex flex-col divide-y divide-border border-t border-border px-5">
        <Row icon={Clock} label="시간">
          <span className="tabular-nums">{formatEventTime(event)}</span>
        </Row>
        <Row icon={CalendarDays} label="날짜">
          <time dateTime={event.date}>{formatDateKeyFull(event.date)}</time>
        </Row>
        {event.location && (
          <Row icon={MapPin} label="장소">
            {event.location}
          </Row>
        )}
        <Row icon={User} label="참여">
          {members.length === 0 ? (
            <span className="text-muted-foreground">아직 참여자가 없어요</span>
          ) : (
            <span className="flex flex-wrap gap-1.5">
              {members.map((m) => (
                <MemberChip key={m.id} member={m} />
              ))}
            </span>
          )}
        </Row>
        {event.memo && (
          <Row icon={StickyNote} label="메모">
            <span className="whitespace-pre-wrap">{event.memo}</span>
          </Row>
        )}
      </dl>
      <p className="px-5 text-sm text-muted-foreground">
        {creator?.name ?? "가족"}이(가) 만든 일정 ·{" "}
        {canEdit ? "작성자라서 수정·삭제할 수 있어요 (데모 규칙)" : "작성자만 수정·삭제할 수 있어요 (데모 규칙)"}
      </p>
      {canEdit && (
        <div className="grid grid-cols-2 gap-2 px-5">
          <Button variant="outline" size="lg" onClick={onEdit}>
            <Pencil aria-hidden="true" />
            수정
          </Button>
          <Button variant="destructive" size="lg" onClick={onDelete}>
            <Trash2 aria-hidden="true" />
            삭제
          </Button>
        </div>
      )}
    </>
  )
}

function Row({ icon: Icon, label, children }: { icon: typeof Clock; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-12 items-start gap-3 py-3">
      <dt className="flex w-16 shrink-0 items-center gap-1.5 pt-0.5 text-sm text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
        {label}
      </dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  )
}
