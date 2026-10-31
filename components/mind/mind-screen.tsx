"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, Check, ChevronRight, Lock, Send } from "lucide-react"

import { DemoViewerSwitch } from "@/components/demo/demo-viewer-switch"
import { FamilyAvatar } from "@/components/home/family-avatar"
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
import { FlowHeading, FlowLead, FlowPage, StepLabel } from "@/components/woorijip/flow-page"
import { LeaveDialog } from "@/components/woorijip/leave-dialog"
import { IS_DEMO } from "@/lib/app-mode"
import { findMember } from "@/lib/home.fixture"
import { MIND_MAX_LENGTH } from "@/lib/mind/config"
import { relationshipAdapter, SYNTHETIC_EXAMPLE } from "@/lib/mind/relationship-demo-adapter"
import type { MindMessage } from "@/lib/mind/types"

import { AdapterStatus } from "./adapter-status"
import { useMind } from "./mind-provider"
import { RecipientPicker } from "./recipient-picker"
import { useReturnFocus } from "./use-return-focus"

const STEP_TITLE = {
  compose: "마음 전하기",
  refine: "표현 다듬기",
  confirm: "전송 전 확인",
  sent: "마음을 전했어요",
} as const

function isBlank(s: string) {
  return s.trim().length === 0
}

/**
 * 마음 전하기 작성 흐름(전체 화면, 3단계 + 완료).
 * 원문(나만 봄)과 전달 문장은 분리되고, 전달은 확인 단계의 명시적 버튼으로만 일어난다.
 * 실제 AI는 연결되지 않았으므로 제안을 미리 채우지 않고 직접 쓴다.
 */
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

  const back =
    draft.step === "compose"
      ? close
      : draft.step === "refine"
        ? () => dispatch({ type: "draft/step", step: "compose" })
        : draft.step === "confirm"
          ? () => dispatch({ type: "draft/step", step: "refine" })
          : undefined

  return (
    <FlowPage
      title={STEP_TITLE[draft.step]}
      back={back}
      backLabel={draft.step === "compose" ? "작성 닫기" : "이전 단계"}
      action={<StepActions viewerId={viewerId} viewerName={viewer.name} recipient={recipient} />}
    >
      <DemoViewerSwitch />
      {draft.step === "compose" && <ComposeStep />}
      {draft.step === "refine" && <RefineStep />}
      {draft.step === "confirm" && <ConfirmStep />}
      {draft.step === "sent" && <SentStep />}

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
    </FlowPage>
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
      <div className="flex flex-col gap-2 pt-2">
        <StepLabel>1 / 3 · 수신자와 원문</StepLabel>
        <FlowHeading>마음을 정리해 볼까요?</FlowHeading>
        <FlowLead>아직 누구에게도 보이지 않는 나만의 작성 공간이에요.</FlowLead>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground" id="mind-recipient-label">
          누구에게 전할까요?
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
          내가 하고 싶은 말 · 나만 보는 원문
        </label>
        <Textarea
          id="mind-raw"
          value={draft.rawText}
          maxLength={MIND_MAX_LENGTH}
          rows={8}
          placeholder="지금 느끼는 그대로 적어도 괜찮아요."
          aria-describedby="mind-raw-count mind-raw-help"
          aria-invalid={showError || undefined}
          onBlur={() => setTouched(true)}
          onChange={(e) => dispatch({ type: "draft/update", patch: { rawText: e.target.value } })}
        />
        <div className="flex items-start justify-between gap-3">
          <p id="mind-raw-help" className="flex items-center gap-1.5 text-sm font-medium text-primary">
            <Lock className="size-4 shrink-0" aria-hidden="true" />
            이 원문은 전송되지 않아요
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
  const { family, draft, dispatch, canSuggest, suggest, suggestion } = useMind()
  const recipient = draft.recipientId ? findMember(family, draft.recipientId) : undefined
  const suggestPhase = suggestion.phase
  const [confirmCopy, setConfirmCopyState] = React.useState<"raw" | "example" | "suggest" | null>(null)
  const [exampleOpen, setExampleOpenState] = React.useState(false)
  const hasOutgoing = !isBlank(draft.outgoingText)
  const exampleFocus = useReturnFocus()
  const copyFocus = useReturnFocus()
  // 대화상자를 연 버튼으로 포커스를 돌려준다.
  const setExampleOpen = (open: boolean) => {
    if (open) exampleFocus.capture()
    setExampleOpenState(open)
  }
  const setConfirmCopy = (next: "raw" | "example" | "suggest" | null) => {
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
      <div className="flex flex-col gap-2 pt-2">
        <StepLabel>2 / 3 · 전달할 문장</StepLabel>
        <FlowHeading>
          상대에게 보일 문장을
          <br />
          직접 다듬어 볼까요?
        </FlowHeading>
        <FlowLead>
          {canSuggest
            ? "원하면 AI 제안을 받아 출발점으로 쓰고, 보내기 전에 꼭 직접 확인·수정해 주세요. 원문은 제안을 만들 때만 서버에 전달되고 보관되지 않아요."
            : "실제 AI는 아직 연결되지 않아 제안을 만들지 않아요. 원문을 보며 전달할 문장을 직접 써 주세요."}
        </FlowLead>
      </div>

      <section aria-labelledby="mind-raw-title" className="flex flex-col gap-1 rounded-r-lg border-l-3 border-input bg-muted px-4 py-3">
        <h2 id="mind-raw-title" className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Lock className="size-3.5" aria-hidden="true" />
          내 원문 · 나만 봐요
        </h2>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{draft.rawText}</p>
      </section>

      <AdapterStatus phase={canSuggest ? suggestPhase : "demo"} label={suggestion.label ?? undefined} errorMessage={suggestion.error ?? undefined} />

      <div className="flex flex-wrap gap-2">
        {canSuggest && (
          <Button
            onClick={() => (hasOutgoing && suggestPhase !== "success" ? setConfirmCopy("suggest") : void suggest())}
            disabled={suggestPhase === "loading"}
            aria-busy={suggestPhase === "loading"}
          >
            {suggestPhase === "loading" ? "제안을 받는 중" : suggestPhase === "error" ? "AI 제안 다시 받기" : suggestPhase === "success" ? "다른 제안 받기" : "AI 제안 받기"}
          </Button>
        )}
        <Button variant="outline" onClick={() => (hasOutgoing && draft.outgoingText !== draft.rawText ? setConfirmCopy("raw") : copyRaw())}>
          원문을 초안으로 복사
        </Button>
        {!canSuggest && (
          <Button variant="ghost" onClick={() => setExampleOpen(true)}>
            예시 흐름 보기
          </Button>
        )}
      </div>

      <section className="flex flex-col gap-2">
        <label htmlFor="mind-outgoing" className="text-sm font-semibold text-muted-foreground">
          {recipient?.name}에게 전달할 문장
        </label>
        <Textarea
          id="mind-outgoing"
          value={draft.outgoingText}
          maxLength={MIND_MAX_LENGTH}
          rows={6}
          placeholder="상대에게 보일 문장을 직접 써 주세요."
          aria-describedby="mind-outgoing-count mind-outgoing-help"
          className="border-primary/50 bg-[color-mix(in_oklab,var(--card),var(--secondary)_30%)]"
          onChange={(e) => dispatch({ type: "draft/update", patch: { outgoingText: e.target.value } })}
        />
        <div className="flex items-start justify-between gap-3">
          <p id="mind-outgoing-help" className="text-sm text-muted-foreground">
            사실과 다른 내용이 없는지 확인해 주세요. 상대에게는 이 문장만 보여요.
          </p>
          <Counter id="mind-outgoing-count" length={draft.outgoingText.length} max={MIND_MAX_LENGTH} />
        </div>
      </section>

      <Dialog open={exampleOpen} onOpenChange={setExampleOpen}>
        <DialogContent onCloseAutoFocus={exampleFocus.onCloseAutoFocus}>
          <DialogHeader>
            <DialogTitle>예시 흐름 · 합성 예시</DialogTitle>
            <DialogDescription>작성 중인 내용과 무관한 가상의 예시예요. AI가 만든 결과가 아니에요.</DialogDescription>
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
              {confirmCopy === "raw" ? "원문 내용으로" : confirmCopy === "suggest" ? "AI 제안 문장으로" : "합성 예시 문장으로"} 바뀌고, 지금 쓴 전달 문장은 사라져요.
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
                else if (confirmCopy === "suggest") void suggest()
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
    <div className="flex flex-col items-center gap-3 pt-4 text-center">
      {recipient && <FamilyAvatar member={recipient} size={88} />}
      <StepLabel>{recipient?.name} 님에게</StepLabel>
      <blockquote className="px-1 py-4 text-xl leading-relaxed font-semibold whitespace-pre-wrap">{draft.outgoingText}</blockquote>
      <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
        <Check className="size-4 text-primary" aria-hidden="true" />
        원문이 아닌 이 문장만 전달됩니다.
      </p>
      <p className="text-xs text-muted-foreground">확인 버튼을 눌러야만 데모 수신함에 추가되고, 실제 알림은 보내지 않아요.</p>
    </div>
  )
}

function SentStep() {
  const { family, draft } = useMind()
  const recipient = draft.recipientId ? findMember(family, draft.recipientId) : undefined
  return (
    <div className="flex flex-col items-center gap-4 pt-16 text-center">
      <span className="flex size-20 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Send className="size-8" aria-hidden="true" />
      </span>
      <FlowHeading>
        {recipient?.name} 님에게
        <br />
        마음을 전했어요
      </FlowHeading>
      <FlowLead>
        상대가 읽는 것은 동의나 수락을 의미하지 않아요.
        <br />
        답할 시간을 천천히 기다려 주세요.
      </FlowLead>
      <p className="text-xs text-muted-foreground">
        {IS_DEMO ? "데모 수신함에만 추가됐고 실제 알림은 보내지 않았어요. 새로고침하면 사라져요." : "원문과 초안은 이 기기에서도 지워졌어요. 푸시 알림은 아직 없어요."}
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
  const { draft, dispatch, error } = useMind()
  const sendingRef = React.useRef(false)
  const [sendFailed, setSendFailed] = React.useState(false)

  switch (draft.step) {
    case "compose": {
      const ok = !isBlank(draft.rawText) && draft.recipientId !== null && draft.rawText.length <= MIND_MAX_LENGTH
      return (
        <>
          <Button size="lg" disabled={!ok} onClick={() => dispatch({ type: "draft/step", step: "refine" })}>
            전달 문장 쓰기
            <ChevronRight aria-hidden="true" />
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
        <Button
          size="lg"
          disabled={!ok}
          onClick={() => dispatch({ type: "draft/step", step: "confirm", confirmToken: crypto.randomUUID() })}
        >
          이 문장으로 계속
          <ChevronRight aria-hidden="true" />
        </Button>
      )
    }
    case "confirm":
      return (
        <>
          <Button
            size="lg"
            onClick={async () => {
              // 연타 방지: 첫 클릭 이후는 무시하고, provider도 같은 확인 토큰을 한 번만 받는다(라이브는 서버 requestId로 중복 차단).
              if (sendingRef.current || !draft.recipientId || !draft.confirmToken) return
              sendingRef.current = true
              setSendFailed(false)
              const message: MindMessage = {
                id: crypto.randomUUID(),
                fromId: viewerId,
                toId: draft.recipientId,
                text: draft.outgoingText.trim(),
                createdAt: new Date().toISOString(),
                status: "sent",
                response: null,
              }
              const ok = await dispatch({ type: "message/send", message, confirmToken: draft.confirmToken })
              // 실패하면 같은 토큰으로 다시 시도할 수 있게 잠금을 푼다(서버는 같은 requestId를 한 번만 처리한다).
              if (!ok) {
                sendingRef.current = false
                setSendFailed(true)
              }
            }}
          >
            확인하고 전송
          </Button>
          {sendFailed && (
            <p role="alert" className="text-center text-sm text-destructive">
              {error ?? "전송하지 못했어요. 연결을 확인하고 다시 시도해 주세요."}
            </p>
          )}
          <p className="text-center text-sm text-muted-foreground">
            {viewerName} → {recipient?.name}
            {IS_DEMO ? " · 데모 수신함에만 추가돼요" : " · 상대의 수신함에 전달돼요"}
          </p>
        </>
      )
    case "sent":
      return (
        <>
          <Button size="lg" asChild>
            <Link href="/inbox?tab=sent">보낸 마음 보기</Link>
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" asChild>
              <Link href="/home">우리집으로</Link>
            </Button>
            <Button variant="ghost" onClick={() => dispatch({ type: "draft/reset" })}>
              새 마음 쓰기
            </Button>
          </div>
        </>
      )
  }
}
