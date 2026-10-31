"use client"

import { IS_DEMO } from "@/lib/app-mode"
import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { SearchX } from "lucide-react"

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
import { AppShell } from "@/components/woorijip/app-shell"
import { FlowPage } from "@/components/woorijip/flow-page"
import type { CalendarDraft, CalendarEvent } from "@/lib/calendar/types"
import { draftToEventFields, eventToDraft } from "@/lib/calendar/validate"
import type { Family } from "@/lib/home.fixture"

import { useCalendar } from "./calendar-provider"
import { EventForm } from "./event-form"

const FORM_ID = "event-edit-form"

/** 일정 수정(전체 화면). 작성자(데모 인물 기준)만 열 수 있고, 저장 전에는 원본을 바꾸지 않는다. */
export function EventEditScreen({ id }: { id: string }) {
  const cal = useCalendar()
  const { family, viewerId } = useDemoViewer()
  const event = cal.eventById(id)
  const canEdit = !!event && event.createdByMemberId === viewerId

  if (!event || !canEdit) {
    return (
      <AppShell title="일정 수정" back="/calendar" backLabel="일정으로 돌아가기" hideNav>
        <DemoViewerSwitch />
        <EmptyStateBlock found={!!event} />
      </AppShell>
    )
  }
  return <Editor key={event.id} event={event} family={family} />
}

function EmptyStateBlock({ found }: { found: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-input bg-card px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
        <SearchX className="size-6" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-semibold">{found ? "지금은 수정할 수 없어요" : "이 일정을 찾을 수 없어요"}</p>
        <p className="text-sm text-muted-foreground">
          {found ? "작성자만 수정할 수 있어요 (프론트 데모 규칙)." : "삭제됐거나, 새로고침으로 데모 데이터가 초기화됐을 수 있어요."}
        </p>
      </div>
      <Button asChild>
        <Link href="/calendar">일정으로</Link>
      </Button>
    </div>
  )
}

function Editor({ event, family }: { event: CalendarEvent; family: Family }) {
  const router = useRouter()
  const cal = useCalendar()
  const [initial] = React.useState<CalendarDraft>(() => eventToDraft(event))
  const [dirty, setDirty] = React.useState(false)
  const [discardOpen, setDiscardOpen] = React.useState(false)
  const returnFocus = useReturnFocus()
  const savingRef = React.useRef(false)
  const backHref = `/calendar?date=${event.date}`

  React.useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [dirty])

  async function submit(draft: CalendarDraft) {
    if (savingRef.current) return
    savingRef.current = true
    const fields = draftToEventFields(draft)
    const ok = await cal.update(event.id, fields)
    savingRef.current = false
    if (ok) router.push(`/calendar?saved=updated&date=`)
  }

  function requestClose() {
    if (dirty) {
      returnFocus.capture()
      setDiscardOpen(true)
    } else router.push(backHref)
  }

  return (
    <FlowPage
      title="일정 수정"
      back={requestClose}
      backLabel="수정 닫기"
      action={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="lg" onClick={requestClose}>
            취소
          </Button>
          <Button size="lg" type="submit" form={FORM_ID} disabled={!dirty}>
            저장
          </Button>
        </div>
      }
    >
      <DemoViewerSwitch />
      {IS_DEMO && <p className="text-sm text-muted-foreground">데모 일정에만 반영돼요. 실제 저장·알림은 없어요.</p>}
      <EventForm formId={FORM_ID} mode="edit" initial={initial} family={family} onSubmit={submit} onDirtyChange={setDirty} />

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent onCloseAutoFocus={returnFocus.onCloseAutoFocus}>
          <DialogHeader>
            <DialogTitle>변경 내용을 버릴까요?</DialogTitle>
            <DialogDescription>저장하지 않은 입력은 사라지고 원래 일정은 그대로 유지돼요.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardOpen(false)}>
              계속 수정
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setDiscardOpen(false)
                router.push(backHref)
              }}
            >
              버리기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FlowPage>
  )
}
