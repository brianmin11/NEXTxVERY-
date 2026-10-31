"use client"

import Link from "next/link"
import { Check, ChevronRight, Clock } from "lucide-react"

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
 * 집안일 한 줄(Figma 행). 완료 조작(왼쪽 체크)과 상세 진입(오른쪽 링크)은 형제 요소다. 버튼 안에 버튼을 넣지 않는다.
 * 부모 목록이 경계선(divide-y)을 그리고, 완료 여부는 체크 아이콘 + 취소선 + 접근 가능한 이름으로 함께 전달한다.
 */
export function ChoreCard({ chore, family, viewerId, today, busy = false, onSetStatus }: ChoreCardProps) {
  const assignee = findMember(family, chore.assigneeMemberId)
  const done = chore.status === "done"
  const due = dueLabel(chore, today)
  const allowed = canToggleChore(chore, viewerId)
  const checkLabel = done ? `'${chore.title}' 완료 취소` : `'${chore.title}' 완료로 표시`

  const circle = (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-[22px] items-center justify-center rounded-full border-[1.5px]",
        done ? "border-primary bg-primary text-primary-foreground" : allowed ? "border-input bg-card" : "border-border bg-muted"
      )}
    >
      {done && <Check className="size-3.5" strokeWidth={3} />}
    </span>
  )

  return (
    <div className="flex items-center gap-2 py-2 pr-1">
      {allowed ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={checkLabel}
          disabled={busy}
          onClick={(e) => onSetStatus(chore.id, done ? "todo" : "done", e.currentTarget)}
          className="flex min-h-11 w-11 shrink-0 items-center justify-center self-center rounded-md outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted disabled:opacity-50"
        >
          {circle}
        </button>
      ) : (
        <span className="flex min-h-11 w-11 shrink-0 items-center justify-center self-center" aria-hidden="true">
          {circle}
        </span>
      )}
      <Link
        href={`/chores/${chore.id}`}
        className="flex min-h-15 min-w-0 flex-1 items-center gap-2 rounded-md py-1 pr-1 pl-1 outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset active:bg-muted"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={cn("font-semibold", done && "text-muted-foreground line-through")}>
            {chore.title}
            <span className="sr-only">{done ? ", 완료" : ", 할 일"}</span>
          </span>
          <span className="text-sm text-muted-foreground">
            {assignee?.name ?? "가족"}에게 지정됨 · <span className="tabular-nums">{due.text}</span>
          </span>
          {due.overdue && (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <Clock className="size-3.5" aria-hidden="true" />
              기한이 지났어요
            </span>
          )}
          {!allowed && !done && <span className="sr-only">담당자나 작성자만 완료 표시할 수 있어요</span>}
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">상세 보기</span>
      </Link>
    </div>
  )
}
