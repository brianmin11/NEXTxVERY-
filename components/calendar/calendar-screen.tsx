"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"

import { useDemoViewer } from "@/components/demo/demo-viewer-provider"
import { DemoViewerSwitch } from "@/components/mind/demo-viewer-switch"
import { useReturnFocus } from "@/components/mind/use-return-focus"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Sheet, SheetClose, SheetContent, SheetFooter } from "@/components/ui/sheet"
import { AppShell } from "@/components/woorijip/app-shell"
import { addMonths, formatDateKey, formatMonthTitle, formatWeekday, isValidDateKey, parseDateKey } from "@/lib/calendar/date"
import type { CalendarEvent, DateKey } from "@/lib/calendar/types"

import { useCalendar } from "./calendar-provider"
import { EventDetail } from "./event-detail"
import { EventList } from "./event-list"
import { MonthGrid } from "./month-grid"

const SAVED_NOTICE: Record<string, string> = {
  added: "데모 일정에 추가했어요",
  updated: "데모 일정에 반영했어요",
}

/**
 * 가족 일정 화면(Figma). 데이터 처리는 CalendarProvider·lib/calendar가 맡는다.
 * 추가·수정은 전체 화면(/calendar/new, /calendar/[id]/edit)에서 하고, 돌아오면 ?saved=&date=로 안내와 선택 날짜를 받는다.
 */
export function CalendarScreen() {
  const cal = useCalendar()
  const router = useRouter()
  const params = useSearchParams()
  const { family, viewerId } = useDemoViewer()
  const todayParts = parseDateKey(cal.today)!
  const savedParam = params.get("saved")
  const dateParam = params.get("date")
  const initialDate = dateParam && isValidDateKey(dateParam) ? dateParam : cal.today
  const initialParts = parseDateKey(initialDate) ?? todayParts
  const [cursor, setCursor] = React.useState({ year: initialParts.year, month: initialParts.month })
  const [selected, setSelected] = React.useState<DateKey>(initialDate)
  const [detailId, setDetailId] = React.useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<CalendarEvent | null>(null)
  const [notice, setNotice] = React.useState<string | null>(savedParam ? (SAVED_NOTICE[savedParam] ?? null) : null)
  const sheetFocus = useReturnFocus()
  const dialogFocus = useReturnFocus()

  const detailEvent = detailId ? cal.eventById(detailId) : undefined
  // 삭제돼 없어진 일정의 상세는 자동으로 닫힌다.
  const detailOpen = detailId !== null && detailEvent !== undefined

  function openDetail(id: string, origin?: HTMLElement | null) {
    sheetFocus.capture(origin)
    setNotice(null)
    setDetailId(id)
  }
  function goToday() {
    setCursor({ year: todayParts.year, month: todayParts.month })
    setSelected(cal.today)
  }
  function moveMonth(delta: number) {
    setCursor((c) => addMonths(c.year, c.month, delta))
  }
  function confirmDelete() {
    if (!deleteTarget) return
    cal.remove(deleteTarget.id)
    setDeleteTarget(null)
    setNotice("데모 일정에서 삭제했어요")
    setDetailId(null)
  }

  const dayEvents = cal.eventsOn(selected)
  const newHref = `/calendar/new?date=${selected}`

  return (
    <AppShell
      title="가족 일정"
      actions={
        <Button variant="ghost" size="icon" className="rounded-full" asChild>
          <Link href={newHref} aria-label="일정 추가">
            <Plus className="size-6" aria-hidden="true" />
          </Link>
        </Button>
      }
    >
      <DemoViewerSwitch />

      <div className="-mx-4 flex flex-col gap-1 border-b border-border bg-card px-4 pb-4">
        <section aria-label="월 선택" className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="이전 달" onClick={() => moveMonth(-1)}>
            <ChevronLeft className="size-5" aria-hidden="true" />
          </Button>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tabular-nums" aria-live="polite">
              {formatMonthTitle(cursor.year, cursor.month)}
            </h2>
            <Button variant="ghost" className="h-11 px-2 text-sm text-primary" onClick={goToday}>
              오늘
            </Button>
          </div>
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="다음 달" onClick={() => moveMonth(1)}>
            <ChevronRight className="size-5" aria-hidden="true" />
          </Button>
        </section>
        <MonthGrid
          year={cursor.year}
          month={cursor.month}
          selected={selected}
          today={cal.today}
          countsByDate={cal.countsByDate}
          onSelect={setSelected}
        />
      </div>

      {notice && (
        <p role="status" className="rounded-lg bg-secondary px-4 py-2 text-sm">
          {notice}
        </p>
      )}

      <section aria-labelledby="day-title" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="day-title" className="text-base font-bold tracking-tight">
            {formatDateKey(selected)} {formatWeekday(selected)}
            {selected === cal.today && <span className="ml-1.5 text-sm font-semibold text-primary">오늘</span>}
          </h2>
          <span className="text-sm text-muted-foreground tabular-nums">
            {dayEvents.length > 0 ? `일정 ${dayEvents.length}개` : ""}
          </span>
        </div>
        <EventList events={dayEvents} family={family} date={selected} onOpen={(id, origin) => openDetail(id, origin)} />
      </section>

      <p className="text-xs text-muted-foreground">메모리에만 있는 데모예요. 새로고침하면 추가·수정한 일정이 사라져요. 표시 시간대: {cal.timeZone}</p>

      {/* 상세 시트 */}
      <Sheet open={detailOpen} onOpenChange={(o) => !o && setDetailId(null)}>
        <SheetContent side="bottom" onCloseAutoFocus={sheetFocus.onCloseAutoFocus}>
          <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" />
          {detailEvent && (
            <EventDetail
              event={detailEvent}
              family={family}
              viewerId={viewerId}
              onEdit={() => router.push(`/calendar/${detailEvent.id}/edit`)}
              onDelete={() => {
                dialogFocus.capture()
                setDeleteTarget(detailEvent)
              }}
            />
          )}
          <SheetFooter className="px-5 pb-5">
            <SheetClose asChild>
              <Button variant="outline" size="lg">
                닫기
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* 삭제 확인 */}
      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent onCloseAutoFocus={dialogFocus.onCloseAutoFocus}>
          <DialogHeader>
            <DialogTitle>‘{deleteTarget?.title}’ 일정을 삭제할까요?</DialogTitle>
            <DialogDescription>데모 일정에서만 지워져요. 되돌릴 수 없어요.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              취소
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
