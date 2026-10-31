"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CircleCheck } from "lucide-react"

import { useDemoViewer } from "@/components/demo/demo-viewer-provider"
import { DemoViewerSwitch } from "@/components/mind/demo-viewer-switch"
import { useReturnFocus } from "@/components/mind/use-return-focus"
import { Button } from "@/components/ui/button"
import { FlowPage } from "@/components/woorijip/flow-page"
import { LeaveDialog } from "@/components/woorijip/leave-dialog"
import { draftToChoreFields } from "@/lib/chores/validate"

import { ChoreForm } from "./chore-form"
import { useChores } from "./chores-provider"

/** 집안일 추가(전체 화면). 현재 데모 인물이 기본 담당자이고 바꿀 수 있다. */
export function ChoreNewScreen() {
  const router = useRouter()
  const { family } = useDemoViewer()
  const chores = useChores()
  const { draft, draftDirty } = chores
  const [leaveOpen, setLeaveOpen] = React.useState(false)
  const submittingRef = React.useRef(false)
  const leaveFocus = useReturnFocus()
  const done = draft.step === "done"

  React.useEffect(() => {
    if (!draftDirty) return
    const handler = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [draftDirty])

  function submit() {
    if (submittingRef.current || !draft.submitToken) return
    submittingRef.current = true
    chores.addChore(draftToChoreFields(draft), draft.submitToken)
    submittingRef.current = false
  }

  function close() {
    if (draftDirty) {
      leaveFocus.capture()
      setLeaveOpen(true)
      return
    }
    if (done) chores.resetDraft()
    router.push("/chores")
  }

  return (
    <FlowPage
      title={done ? "할 일을 추가했어요" : "할 일 추가"}
      eyebrow={done ? "완료" : "새 집안일"}
      back={close}
      backLabel="작성 닫기"
      action={
        done ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="lg" asChild>
              <Link href="/chores" onClick={() => chores.resetDraft()}>
                목록으로
              </Link>
            </Button>
            <Button size="lg" asChild>
              <Link href={`/chores/${draft.createdId}`} onClick={() => chores.resetDraft()}>
                할 일 보기
              </Link>
            </Button>
            <Button variant="ghost" className="col-span-2" onClick={() => chores.resetDraft()}>
              하나 더 추가
            </Button>
          </div>
        ) : (
          <Button size="lg" type="submit" form="chore-new-form">
            할 일 저장
          </Button>
        )
      }
    >
      <DemoViewerSwitch />
      {done ? (
        <div className="flex flex-col items-center gap-3 rounded-xl bg-card px-6 py-10 text-center ring-1 ring-border">
          <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
            <CircleCheck className="size-6" aria-hidden="true" />
          </span>
          <p className="font-semibold">데모 할 일에 추가했어요</p>
          <p className="text-sm text-muted-foreground">담당자에게 알림은 가지 않아요. 새로고침하면 사라지는 메모리 데모예요.</p>
        </div>
      ) : (
        <ChoreForm formId="chore-new-form" draft={draft} family={family} onChange={chores.updateDraft} onSubmit={submit} />
      )}

      <LeaveDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        onCloseAutoFocus={leaveFocus.onCloseAutoFocus}
        onLeave={() => router.push("/chores")}
        onDiscard={() => {
          chores.resetDraft()
          router.push("/chores")
        }}
      />
    </FlowPage>
  )
}
