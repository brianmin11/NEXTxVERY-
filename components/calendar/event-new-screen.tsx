"use client"

import { IS_DEMO } from "@/lib/app-mode"
import * as React from "react"
import { useRouter } from "next/navigation"

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
import { FlowPage } from "@/components/woorijip/flow-page"
import { isValidDateKey } from "@/lib/calendar/date"
import type { CalendarDraft } from "@/lib/calendar/types"
import { draftToEventFields, emptyDraft } from "@/lib/calendar/validate"

import { useCalendar } from "./calendar-provider"
import { EventForm } from "./event-form"

const FORM_ID = "event-new-form"

/** 일정 추가(전체 화면). ?date=가 유효하면 그 날짜, 아니면 오늘로 시작한다. 데모 일정에만 반영된다. */
export function EventNewScreen({ initialDate }: { initialDate?: string }) {
  const router = useRouter()
  const cal = useCalendar()
  const { family, viewerId } = useDemoViewer()
  const date = initialDate && isValidDateKey(initialDate) ? initialDate : cal.today
  const [initial] = React.useState<CalendarDraft>(() => emptyDraft(date, [viewerId]))
  const [dirty, setDirty] = React.useState(false)
  const [discardOpen, setDiscardOpen] = React.useState(false)
  const returnFocus = useReturnFocus()
  const savingRef = React.useRef(false)
  const backHref = `/calendar?date=${date}`

  React.useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [dirty])

  async function submit(draft: CalendarDraft, token: string) {
    if (savingRef.current) return
    savingRef.current = true
    const fields = draftToEventFields(draft)
    const ok = await cal.add({ id: crypto.randomUUID(), createdByMemberId: viewerId, ...fields }, token)
    savingRef.current = false
    if (ok) router.push(`/calendar?saved=added&date=`)
  }

  function requestClose() {
    if (dirty) {
      returnFocus.capture()
      setDiscardOpen(true)
    } else router.push(backHref)
  }

  return (
    <FlowPage
      title="일정 추가"
      back={requestClose}
      backLabel="작성 닫기"
      action={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="lg" onClick={requestClose}>
            취소
          </Button>
          <Button size="lg" type="submit" form={FORM_ID}>
            추가
          </Button>
        </div>
      }
    >
      <DemoViewerSwitch />
      {IS_DEMO && <p className="text-sm text-muted-foreground">데모 일정에만 반영돼요. 실제 저장·알림은 없어요.</p>}
      <EventForm formId={FORM_ID} mode="create" initial={initial} family={family} onSubmit={submit} onDirtyChange={setDirty} />

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent onCloseAutoFocus={returnFocus.onCloseAutoFocus}>
          <DialogHeader>
            <DialogTitle>작성 내용을 버릴까요?</DialogTitle>
            <DialogDescription>저장하지 않은 입력은 사라져요.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardOpen(false)}>
              계속 작성
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
