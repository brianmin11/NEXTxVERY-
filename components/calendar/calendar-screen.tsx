"use client"

import * as React from "react"
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react"

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
import { AppShell, DemoBadge } from "@/components/woorijip/app-shell"
import { addMonths, formatDateKey, formatMonthTitle, formatWeekday, parseDateKey } from "@/lib/calendar/date"
import type { CalendarDraft, CalendarEvent, DateKey } from "@/lib/calendar/types"
import { draftToEventFields, emptyDraft, eventToDraft } from "@/lib/calendar/validate"

import { useCalendar } from "./calendar-provider"
import { EventDetail } from "./event-detail"
import { EventForm } from "./event-form"
import { EventList } from "./event-list"
import { MonthGrid } from "./month-grid"

type View = { type: "detail"; id: string } | { type: "create"; date: DateKey } | { type: "edit"; id: string } | null

/** 가족 일정 화면 조립. 데이터 처리는 CalendarProvider·lib/calendar가 맡는다. */
export function CalendarScreen() {
  const cal = useCalendar()
  const { family, viewerId } = useDemoViewer()
  const todayParts = parseDateKey(cal.today)!
  const [cursor, setCursor] = React.useState({ year: todayParts.year, month: todayParts.month })
  const [selected, setSelected] = React.useState<DateKey>(cal.today)
  const [view, setView] = React.useState<View>(null)
  const [formDirty, setFormDirty] = React.useState(false)
  const [discardOpen, setDiscardOpen] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<CalendarEvent | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)
  const sheetFocus = useReturnFocus()
  const dialogFocus = useReturnFocus()

  const detailEvent = view?.type === "detail" || view?.type === "edit" ? cal.eventById(view.id) : undefined
  // 삭제돼 없어진 일정의 상세는 자동으로 닫힌다.
  const detailOpen = view?.type === "detail" && detailEvent !== undefined
  const formOpen = view?.type === "create" || (view?.type === "edit" && detailEvent !== undefined)

  function open(next: Exclude<View, null>, origin?: HTMLElement | null) {
    sheetFocus.capture(origin)
    setFormDirty(false)
    setNotice(null)
    setView(next)
  }
  function closeAll() {
    setView(null)
    setFormDirty(false)
  }
  function requestCloseForm() {
    if (formDirty) {
      dialogFocus.capture()
      setDiscardOpen(true)
    } else closeAll()
  }
  function goToday() {
    setCursor({ year: todayParts.year, month: todayParts.month })
    setSelected(cal.today)
  }
  function moveMonth(delta: number) {
    setCursor((c) => addMonths(c.year, c.month, delta))
  }

  function handleSubmit(draft: CalendarDraft, token: string) {
    const fields = draftToEventFields(draft)
    if (view?.type === "edit" && detailEvent) {
      cal.update(detailEvent.id, fields)
      setNotice("데모 일정에 반영했어요")
    } else {
      cal.add({ id: crypto.randomUUID(), createdByMemberId: viewerId, ...fields }, token)
      setNotice("데모 일정에 추가했어요")
    }
    const p = parseDateKey(fields.date)
    if (p) setCursor({ year: p.year, month: p.month })
    setSelected(fields.date)
    closeAll()
  }

  function confirmDelete() {
    if (!deleteTarget) return
    cal.remove(deleteTarget.id)
    setDeleteTarget(null)
    setNotice("데모 일정에서 삭제했어요")
    closeAll()
  }

  const dayEvents = cal.eventsOn(selected)
  const initialDraft: CalendarDraft | null =
    view?.type === "create"
      ? emptyDraft(view.date, [viewerId])
      : view?.type === "edit" && detailEvent
        ? eventToDraft(detailEvent)
        : null

  return (
    <AppShell
      title={<h1 className="text-lg font-bold">가족 일정</h1>}
      actions={
        <Button variant="ghost" onClick={(e) => open({ type: "create", date: selected }, e.currentTarget)}>
          <CalendarPlus aria-hidden="true" />
          일정 추가
        </Button>
      }
    >
      <DemoBadge />
      <DemoViewerSwitch />
      <p className="text-sm text-muted-foreground">
        메모리에만 있는 데모예요. 새로고침하면 추가·수정한 일정이 사라져요. 표시 시간대: {cal.timeZone}
      </p>

      <section aria-label="월 선택" className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="icon" aria-label="이전 달" onClick={() => moveMonth(-1)}>
          <ChevronLeft className="size-5" aria-hidden="true" />
        </Button>
        <h2 className="text-lg font-bold tabular-nums" aria-live="polite">
          {formatMonthTitle(cursor.year, cursor.month)}
        </h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" onClick={goToday}>
            오늘
          </Button>
          <Button variant="ghost" size="icon" aria-label="다음 달" onClick={() => moveMonth(1)}>
            <ChevronRight className="size-5" aria-hidden="true" />
          </Button>
        </div>
      </section>

      <MonthGrid
        year={cursor.year}
        month={cursor.month}
        selected={selected}
        today={cal.today}
        countsByDate={cal.countsByDate}
        onSelect={setSelected}
      />

      {notice && (
        <p role="status" className="rounded-xl bg-secondary px-4 py-2 text-sm">
          {notice}
        </p>
      )}

      <section aria-labelledby="day-title" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="day-title" className="text-base font-semibold">
            {formatDateKey(selected)}
            <span className="sr-only"> {formatWeekday(selected)}</span>
            {selected === cal.today && <span className="ml-1 text-sm font-medium text-primary">오늘</span>}
          </h2>
          <span className="text-sm text-muted-foreground tabular-nums">
            {dayEvents.length > 0 ? `일정 ${dayEvents.length}개` : ""}
          </span>
        </div>
        <EventList
          events={dayEvents}
          family={family}
          onOpen={(id, origin) => open({ type: "detail", id }, origin)}
          onAdd={(origin) => open({ type: "create", date: selected }, origin)}
        />
      </section>

      {/* 상세 시트 */}
      <Sheet open={detailOpen} onOpenChange={(o) => !o && closeAll()}>
        <SheetContent side="bottom" onCloseAutoFocus={sheetFocus.onCloseAutoFocus}>
          <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" />
          {detailEvent && (
            <EventDetail
              event={detailEvent}
              family={family}
              viewerId={viewerId}
              onEdit={() => {
                setFormDirty(false)
                setView({ type: "edit", id: detailEvent.id })
              }}
              onDelete={() => {
                dialogFocus.capture()
                setDeleteTarget(detailEvent)
              }}
            />
          )}
          <SheetFooter className="px-5 pb-5">
            <SheetClose asChild>
              <Button variant="secondary" size="lg">
                닫기
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* 추가·수정 폼 시트: 긴 폼이라 높게 띄우고 안에서 스크롤 */}
      <Sheet open={formOpen} onOpenChange={(o) => !o && requestCloseForm()}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="max-h-[92dvh] gap-3 pb-0"
          onCloseAutoFocus={sheetFocus.onCloseAutoFocus}
          onEscapeKeyDown={(e) => {
            e.preventDefault()
            requestCloseForm()
          }}
        >
          <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" />
          {formOpen && initialDraft && (
            <EventForm
              key={view?.type === "edit" ? `edit-${view.id}` : `create-${(view as { date: DateKey }).date}`}
              mode={view?.type === "edit" ? "edit" : "create"}
              initial={initialDraft}
              family={family}
              onSubmit={handleSubmit}
              onCancel={requestCloseForm}
              onDirtyChange={setFormDirty}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* 작성 내용 유실 확인 */}
      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent onCloseAutoFocus={dialogFocus.onCloseAutoFocus}>
          <DialogHeader>
            <DialogTitle>변경 내용을 버릴까요?</DialogTitle>
            <DialogDescription>저장하지 않은 입력은 사라지고 원래 일정은 그대로 유지돼요.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardOpen(false)}>
              계속 작성
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setDiscardOpen(false)
                closeAll()
              }}
            >
              버리기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
