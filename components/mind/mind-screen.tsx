"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, CircleCheck, Lock, Send, X } from "lucide-react"

import { FamilyAvatar } from "@/components/home/family-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { findMember } from "@/lib/home.fixture"
import { MIND_MAX_LENGTH } from "@/lib/mind/config"
import { relationshipAdapter, SYNTHETIC_EXAMPLE } from "@/lib/mind/relationship-demo-adapter"
import type { MindMessage } from "@/lib/mind/types"

import { AdapterStatus } from "./adapter-status"
import { DemoViewerSwitch } from "./demo-viewer-switch"
import { useMind } from "./mind-provider"
import { LeaveDialog } from "@/components/woorijip/leave-dialog"

import { RecipientPicker } from "./recipient-picker"
import { useReturnFocus } from "./use-return-focus"

const STEP_TITLE = {
  compose: "어떤 마음을 전하고 싶나요?",
  refine: "전달할 문장 다듬기",
  confirm: "전달 내용 확인",
  sent: "데모 수신함에 추가했어요",
} as const
const STEP_INDEX = { compose: 1, refine: 2, confirm: 3, sent: 3 } as const

function isBlank(s: string) {
  return s.trim().length === 0
}

/** 마음 전하기 작성 흐름(전체 화면). 바텀시트가 아니라 긴 입력에 맞춘 단독 화면이다. */
export function MindScreen() {
  const router = useRouter()
  const { family, viewer, viewerId, draft, draftDirty, dispatch } = useMind()
  const recipient = draft.recipientId ? findMember(family, draft.recipientId) : undefined
  const [leaveOpen, setLeaveOpen] = React.useState(false)
  const leaveFocus = useReturnFocus()

  // 새로고침·탭 닫기 때 브라우저 경고. 앱 안 이동은 초안이 유지되므로 경고하지 않는다.
  React.useEffect(() => {
    if (!draftDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [draftDirty])

  function close() {
    if (draftDirty) {
      leaveFocus.capture()
      setLeaveOpen(true)
    } else router.push("/home")
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between gap-2 px-4">
          <Button variant="ghost" size="icon" aria-label="작성 닫기" onClick={close}>
            <X className="size-5" aria-hidden="true" />
          </Button>
          <p className="text-sm font-medium text-muted-foreground tabular-nums">
            {draft.step === "sent" ? "완료" : `${STEP_INDEX[draft.step]} / 3`}
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-4 pb-6">
        <Badge variant="outline" className="h-6 self-start px-2.5 text-muted-foreground">
          프론트 데모 · 실제 AI 및 계정 보호 미연결
        </Badge>
        <DemoViewerSwitch />
        <h1 className="text-2xl leading-snug font-bold tracking-tight">{STEP_TITLE[draft.step]}</h1>

        {draft.step === "compose" && <ComposeStep />}
        {draft.step === "refine" && <RefineStep />}
        {draft.step === "confirm" && <ConfirmStep />}
        {draft.step === "sent" && <SentStep />}
      </main>

      <LeaveDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        onCloseAutoFocus={leaveFocus.onCloseAutoFocus}
        onLeave={() => router.push("/home")}
        onDiscard={() => {
          dispatch({ type: "draft/reset" })
          router.push("/home")
        }}
      />
      {/* 화면 아래 고정 버튼. 키보드가 열리면 뷰포트가 줄어 버튼이 위로 올라온다. */}
      <footer className="sticky bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto grid max-w-md gap-2 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+--spacing(3))]">
          <StepActions viewerId={viewerId} viewerName={viewer.name} recipient={recipient} />
        </div>
      </footer>
    </div>
  )
}

function Counter({ id, length, max }: { id: string; length: number; max: number }) {
  const over = length > max
  return (
    <p id={id} className={`text-sm tabular-nums ${over ? "text-destructive" : "text-muted-foreground"}`} aria-live="polite">
      {length} / {max}
    </p>
  )
}

function ComposeStep() {
  const { family, viewerId, draft, dispatch } = useMind()
  const [touched, setTouched] = React.useState(false)
  const blank = isBlank(draft.rawText)
  const showError = touched && blank

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground" id="mind-recipient-label">
          받는 사람
        </h2>
        <RecipientPicker
          members={family.members}
          excludeId={viewerId}
          value={draft.recipientId}
          onChange={(id) => dispatch({ type: "draft/update", patch: { recipientId: id } })}
          describedBy="mind-recipient-help"
        />
        <p id="mind-recipient-help" className="text-sm text-muted-foreground">
          {draft.recipientId ? `${findMember(family, draft.recipientId)?.name}에게 전해요.` : "한 명을 골라 주세요."}
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <label htmlFor="mind-raw" className="text-sm font-semibold text-muted-foreground">
          하고 싶은 말 · 나만 보는 원문
        </label>
        <Textarea
          id="mind-raw"
          value={draft.rawText}
          maxLength={MIND_MAX_LENGTH}
          rows={6}
          placeholder="지금 느끼는 그대로 적어도 괜찮아요."
          aria-describedby="mind-raw-count mind-raw-help"
          aria-invalid={showError || undefined}
          onBlur={() => setTouched(true)}
          onChange={(e) => dispatch({ type: "draft/update", patch: { rawText: e.target.value } })}
        />
        <div className="flex items-start justify-between gap-3">
          <p id="mind-raw-help" className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Lock className="size-3.5 shrink-0" aria-hidden="true" />
            원문은 전달 문장에 자동 포함되지 않아요.
          </p>
          <Counter id="mind-raw-count" length={draft.rawText.length} max={MIND_MAX_LENGTH} />
        </div>
        {showError && (
          <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            내용을 입력해 주세요. 공백만으로는 진행할 수 없어요.
          </p>
        )}
      </section>
    </div>
  )
}

function RefineStep() {
  const { family, draft, dispatch } = useMind()
  const recipient = draft.recipientId ? findMember(family, draft.recipientId) : undefined
  const [confirmCopy, setConfirmCopyState] = React.useState<"raw" | "example" | null>(null)
  const [exampleOpen, setExampleOpenState] = React.useState(false)
  const hasOutgoing = !isBlank(draft.outgoingText)
  const exampleFocus = useReturnFocus()
  const copyFocus = useReturnFocus()
  // 대화상자를 연 버튼으로 포커스를 돌려준다.
  const setExampleOpen = (open: boolean) => {
    if (open) exampleFocus.capture()
    setExampleOpenState(open)
  }
  const setConfirmCopy = (next: "raw" | "example" | null) => {
    if (next) copyFocus.capture()
    setConfirmCopyState(next)
  }

  async function copyRaw() {
    // 데모 어댑터는 원문을 그대로 초안으로 돌려준다(생성 아님).
    const result = await relationshipAdapter.draftOutgoing({ rawText: draft.rawText, recipientName: recipient?.name ?? "" })
    const text = result.mode === "manual" ? result.initialText : result.text
    dispatch({ type: "draft/update", patch: { outgoingText: text } })
  }
  function applyExample() {
    dispatch({ type: "draft/update", patch: { outgoingText: SYNTHETIC_EXAMPLE.outgoing } })
    setExampleOpen(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="mind-raw-title" className="flex flex-col gap-2">
        <h2 id="mind-raw-title" className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          <Lock className="size-3.5" aria-hidden="true" />
          내가 쓴 원문 · 나만 봐요
        </h2>
        <p className="rounded-lg bg-muted p-3 leading-relaxed whitespace-pre-wrap">{draft.rawText}</p>
      </section>

      <AdapterStatus phase="demo" />

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => (hasOutgoing && draft.outgoingText !== draft.rawText ? setConfirmCopy("raw") : copyRaw())}>
          원문을 초안으로 복사
        </Button>
        <Button variant="ghost" onClick={() => setExampleOpen(true)}>
          예시 흐름 보기
        </Button>
      </div>

      <section className="flex flex-col gap-2">
        <label htmlFor="mind-outgoing" className="text-sm font-semibold text-muted-foreground">
          {recipient?.name}에게 전달할 문장
        </label>
        <Textarea
          id="mind-outgoing"
          value={draft.outgoingText}
          maxLength={MIND_MAX_LENGTH}
          rows={5}
          placeholder="상대에게 보일 문장을 직접 써 주세요."
          aria-describedby="mind-outgoing-count mind-outgoing-help"
          onChange={(e) => dispatch({ type: "draft/update", patch: { outgoingText: e.target.value } })}
        />
        <div className="flex items-start justify-between gap-3">
          <p id="mind-outgoing-help" className="text-sm text-muted-foreground">
            상대에게는 이 문장만 보여요.
          </p>
          <Counter id="mind-outgoing-count" length={draft.outgoingText.length} max={MIND_MAX_LENGTH} />
        </div>
      </section>

      <Dialog open={exampleOpen} onOpenChange={setExampleOpen}>
        <DialogContent onCloseAutoFocus={exampleFocus.onCloseAutoFocus}>
          <DialogHeader>
            <DialogTitle>예시 흐름 · 합성 예시</DialogTitle>
            <DialogDescription>
              작성 중인 내용과 무관한 가상의 예시예요. AI가 만든 결과가 아니에요.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 text-sm">
            <div>
              <p className="font-medium text-muted-foreground">원문(예시)</p>
              <p className="mt-1 rounded-lg bg-muted p-3">{SYNTHETIC_EXAMPLE.raw}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">전달 문장(예시)</p>
              <p className="mt-1 rounded-lg border border-border p-3">{SYNTHETIC_EXAMPLE.outgoing}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExampleOpen(false)}>
              닫기
            </Button>
            <Button onClick={() => (hasOutgoing ? setConfirmCopy("example") : applyExample())}>예시를 초안에 넣기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmCopy !== null} onOpenChange={(o) => !o && setConfirmCopy(null)}>
        <DialogContent onCloseAutoFocus={copyFocus.onCloseAutoFocus}>
          <DialogHeader>
            <DialogTitle>지금 쓴 전달 문장을 바꿀까요?</DialogTitle>
            <DialogDescription>
              {confirmCopy === "raw" ? "원문 내용으로" : "합성 예시 문장으로"} 바뀌고, 지금 쓴 전달 문장은 사라져요.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCopy(null)}>
              그대로 두기
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmCopy === "raw") void copyRaw()
                else applyExample()
                setConfirmCopy(null)
              }}
            >
              바꾸기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ConfirmStep() {
  const { family, draft } = useMind()
  const recipient = draft.recipientId ? findMember(family, draft.recipientId) : undefined
  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="mind-final-title" className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-border">
        <h2 id="mind-final-title" className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          <Send className="size-3.5" aria-hidden="true" />
          상대에게는 이 문장만 보여요
        </h2>
        {recipient && (
          <div className="flex items-center gap-2">
            <FamilyAvatar member={recipient} size={36} decorative />
            <p className="font-semibold">{recipient.name}에게</p>
          </div>
        )}
        <p className="text-lg leading-relaxed whitespace-pre-wrap">{draft.outgoingText}</p>
      </section>
      <p className="text-sm text-muted-foreground">
        원문은 이 문장에 포함되지 않아요. 확인 버튼을 눌러야만 데모 수신함에 추가되고, 실제 알림은 보내지 않아요.
      </p>
    </div>
  )
}

function SentStep() {
  const { family, draft } = useMind()
  const recipient = draft.recipientId ? findMember(family, draft.recipientId) : undefined
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl bg-card px-6 py-10 text-center ring-1 ring-border">
      <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
        <CircleCheck className="size-6" aria-hidden="true" />
      </span>
      <p className="font-semibold">{recipient?.name}에게 보낼 문장을 데모 수신함에 추가했어요</p>
      <p className="text-sm text-muted-foreground">
        실제 알림은 보내지 않았어요. 이 데모 상태는 메모리에만 있어서 새로고침하면 사라져요.
      </p>
    </div>
  )
}

function StepActions({
  viewerId,
  viewerName,
  recipient,
}: {
  viewerId: string
  viewerName: string
  recipient: ReturnType<typeof findMember>
}) {
  const { draft, dispatch } = useMind()
  const sendingRef = React.useRef(false)

  switch (draft.step) {
    case "compose": {
      const ok = !isBlank(draft.rawText) && draft.recipientId !== null && draft.rawText.length <= MIND_MAX_LENGTH
      return (
        <>
          <Button size="lg" disabled={!ok} onClick={() => dispatch({ type: "draft/step", step: "refine" })}>
            다음: 전달 문장 다듬기
          </Button>
          {!ok && (
            <p className="text-center text-sm text-muted-foreground">
              {draft.recipientId === null ? "받는 사람을 고르면 계속할 수 있어요." : "내용을 입력하면 계속할 수 있어요."}
            </p>
          )}
        </>
      )
    }
    case "refine": {
      const ok = !isBlank(draft.outgoingText) && draft.outgoingText.length <= MIND_MAX_LENGTH
      return (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="lg" onClick={() => dispatch({ type: "draft/step", step: "compose" })}>
            돌아가서 수정
          </Button>
          <Button
            size="lg"
            disabled={!ok}
            onClick={() => dispatch({ type: "draft/step", step: "confirm", confirmToken: crypto.randomUUID() })}
          >
            전달 내용 확인
          </Button>
        </div>
      )
    }
    case "confirm":
      return (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="lg" onClick={() => dispatch({ type: "draft/step", step: "refine" })}>
            돌아가서 수정
          </Button>
          <Button
            size="lg"
            onClick={() => {
              // 연타 방지: 첫 클릭 이후는 무시하고, reducer도 같은 토큰을 한 번만 받는다.
              if (sendingRef.current || !draft.recipientId || !draft.confirmToken) return
              sendingRef.current = true
              const message: MindMessage = {
                id: crypto.randomUUID(),
                fromId: viewerId,
                toId: draft.recipientId,
                text: draft.outgoingText.trim(),
                createdAt: new Date().toISOString(),
                status: "sent",
                response: null,
              }
              dispatch({ type: "message/send", message, confirmToken: draft.confirmToken })
            }}
          >
            확인하고 추가
          </Button>
          <p className="col-span-2 text-center text-sm text-muted-foreground">
            {viewerName} → {recipient?.name} · 데모 수신함에만 추가돼요
          </p>
        </div>
      )
    case "sent":
      return (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="lg" asChild>
            <Link href="/home">홈으로</Link>
          </Button>
          <Button size="lg" asChild>
            <Link href="/inbox?tab=sent">보낸 마음 보기</Link>
          </Button>
          <Button variant="ghost" className="col-span-2" onClick={() => dispatch({ type: "draft/reset" })}>
            새 마음 쓰기
          </Button>
        </div>
      )
  }
}

