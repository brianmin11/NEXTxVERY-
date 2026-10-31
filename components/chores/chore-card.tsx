"use client"

import Link from "next/link"
import { CalendarDays, Check, ChevronRight, Clock } from "lucide-react"

import { FamilyAvatar } from "@/components/home/family-avatar"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { formatDateKey } from "@/lib/calendar/date"
import type { DateKey } from "@/lib/calendar/types"
import { canToggleChore } from "@/lib/chores/permissions"
import type { Chore } from "@/lib/chores/types"
import { findMember, type Family } from "@/lib/home.fixture"
import { cn } from "@/lib/utils"

/** 날짜 표시. 기한이 지나도 안내만 하고 비난·벌점 문구는 쓰지 않는다. */
export function dueLabel(chore: Chore, today: DateKey): { text: string; overdue: boolean; isToday: boolean } {
  if (!chore.dueDate) return { text: "날짜 미정", overdue: false, isToday: false }
  if (chore.dueDate === today) return { text: "오늘", overdue: false, isToday: true }
  const overdue = chore.status === "todo" && chore.dueDate < today
  return { text: formatDateKey(chore.dueDate), overdue, isToday: false }
}

type ChoreCardProps = {
  chore: Chore
  family: Family
  viewerId: string
  today: DateKey
  /** 상태 변경 중이면 조작을 막는다 */
  busy?: boolean
  onSetStatus: (id: string, status: "todo" | "done", origin: HTMLElement) => void
}

/**
 * 완료 조작(왼쪽 체크)과 상세 진입(오른쪽 링크)은 형제 요소다. 버튼 안에 버튼을 넣지 않는다.
 * 완료 여부는 체크 아이콘 + 상태 텍스트 + 접근 가능한 이름으로 함께 전달한다.
 */
export function ChoreCard({ chore, family, viewerId, today, busy = false, onSetStatus }: ChoreCardProps) {
  const assignee = findMember(family, chore.assigneeMemberId)
  const done = chore.status === "done"
  const due = dueLabel(chore, today)
  const allowed = canToggleChore(chore, viewerId)
  const checkLabel = done ? `'${chore.title}' 완료 취소` : `'${chore.title}' 완료로 표시`

  return (
    <Card size="sm" className="py-0">
      <div className="flex items-stretch gap-1 py-1 pr-1 pl-2">
        {allowed ? (
          <button
            type="button"
            role="checkbox"
            aria-checked={done}
            aria-label={checkLabel}
            disabled={busy}
            onClick={(e) => onSetStatus(chore.id, done ? "todo" : "done", e.currentTarget)}
            className={cn(
              "flex w-11 shrink-0 items-center justify-center self-center rounded-lg outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted disabled:opacity-50",
              "min-h-11"
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex size-6 items-center justify-center rounded-full border-2",
                done ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card"
              )}
            >
              {done && <Check className="size-4" strokeWidth={3} />}
            </span>
          </button>
        ) : (
          <span className="flex w-11 shrink-0 items-center justify-center self-center" aria-hidden="true">
            <span className={cn("flex size-6 items-center justify-center rounded-full border-2", done ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted")}>
              {done && <Check className="size-4" strokeWidth={3} />}
            </span>
          </span>
        )}
        <Link
          href={`/chores/${chore.id}`}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg py-2 pr-1 pl-1 outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className={cn("font-semibold", done && "text-muted-foreground line-through")}>
              {chore.title}
              <span className="sr-only">{done ? ", 완료" : ", 할 일"}</span>
            </span>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              {assignee && (
                <span className="flex items-center gap-1">
                  <FamilyAvatar member={assignee} size={20} decorative />
                  {assignee.name}
                </span>
              )}
              <span className="flex items-center gap-1 tabular-nums">
                <CalendarDays className="size-3.5" aria-hidden="true" />
                {due.text}
              </span>
              {due.overdue && (
                <Badge variant="outline" className="h-5 gap-1 px-1.5 text-muted-foreground">
                  <Clock aria-hidden="true" />
                  기한 지남
                </Badge>
              )}
              {!allowed && !done && <span className="sr-only">담당자나 작성자만 완료 표시할 수 있어요</span>}
            </span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">상세 보기</span>
        </Link>
      </div>
    </Card>
  )
}
