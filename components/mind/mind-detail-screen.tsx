"use client"

import * as React from "react"
import Link from "next/link"
import { Ban, Clock, MessageCircle, SearchX } from "lucide-react"

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
import { AppShell } from "@/components/woorijip/app-shell"
import { StepLabel } from "@/components/woorijip/flow-page"
import { EmptyState } from "@/components/woorijip/state-views"
import { IS_DEMO } from "@/lib/app-mode"
import { formatFullDate, formatTime } from "@/lib/format"
import { findMember } from "@/lib/home.fixture"
import { MIND_REPLY_MAX_LENGTH } from "@/lib/mind/config"
import type { MindResponse } from "@/lib/mind/types"

import { useMind } from "./mind-provider"
import { MindStatusBadge } from "./mind-status"
import { useReturnFocus } from "./use-return-focus"

type PendingAction = { kind: "reply"; text: string } | { kind: "later" } | { kind: "declined" } | null

const RESPONSE_LABEL: Record<MindResponse["kind"], string> = {
  reply: "답장",
  later: "나중에 이야기하기로 했어요",
  declined: "지금은 어렵다고 답했어요",
}

/**
 * 메시지 상세. 받은 사람만 응답할 수 있고(데모 인물 기준), 열람은 응답과 구분된다.
 * 읽음 처리는 이 화면에 들어올 때 한 곳에서만 한다(목록 클릭·URL 직접 진입 모두 같은 경로).
 * 보낸 사람이 자기 메시지를 열어도 읽음으로 바뀌지 않는다.
 */
export function MindDetailScreen({ id }: { id: string }) {
  const { family, viewerId, messages, dispatch } = useMind()
  const message = messages.find((m) => m.id === id)
  const [replyOpen, setReplyOpen] = React.useState(false)
  const [reply, setReply] = React.useState("")
  const [pending, setPendingState] = React.useState<PendingAction>(null)
  const articleRef = React.useRef<HTMLElement | null>(null)
  // 응답 후에는 버튼이 사라지므로 메시지 본문으로 포커스를 보낸다.
  const returnFocus = useReturnFocus(articleRef)
  // 확인 대화상자를 연 버튼으로 포커스를 돌려준다.
  const setPending = (next: PendingAction) => {
    if (next) returnFocus.capture()
    setPendingState(next)
  }

  const shouldMarkRead = !!message && message.toId === viewerId && message.status === "sent"
  React.useEffect(() => {
    // 서버 연동 시 이 자리가 "상세 조회 = 읽음 처리" 호출로 바뀐다.
    if (shouldMarkRead) void dispatch({ type: "message/read", id })
  }, [shouldMarkRead, id, dispatch])

  if (!message || (message.toId !== viewerId && message.fromId !== viewerId)) {
    return (
      <AppShell title="마음" back="/inbox" backLabel="수신함으로 돌아가기" hideNav>
        <DemoViewerSwitch />
        <EmptyState
          icon={SearchX}
          title={IS_DEMO ? "이 인물에게는 보이지 않는 메시지예요" : "볼 수 없는 메시지예요"}
          description={
            IS_DEMO
              ? "데모 인물을 보낸 사람이나 받는 사람으로 바꾸면 볼 수 있어요. 새로고침으로 사라졌을 수도 있어요."
              : "보낸 사람과 받는 사람만 볼 수 있어요. 주소가 잘못됐거나 삭제된 메시지일 수 있어요."
          }
          action={
            <Button asChild>
              <Link href="/inbox">수신함으로</Link>
            </Button>
          }
        />
      </AppShell>
    )
  }

  const isRecipient = message.toId === viewerId
  const from = findMember(family, message.fromId)
  const to = findMember(family, message.toId)
  const other = isRecipient ? from : to
  const at = new Date(message.createdAt)
  const canRespond = isRecipient && message.response === null
  const replyBlank = reply.trim().length === 0

  async function commit() {
    if (!pending || !message) return
    const atNow = new Date().toISOString()
    const response: MindResponse =
      pending.kind === "reply" ? { kind: "reply", text: pending.text.trim(), at: atNow } : { kind: pending.kind, at: atNow }
    const ok = await dispatch({ type: "message/respond", id: message.id, response })
    setPending(null)
    if (!ok) return
    setReplyOpen(false)
    setReply("")
  }

  return (
    <AppShell title={isRecipient ? "받은 마음" : "보낸 마음"} back="/inbox" backLabel="수신함으로 돌아가기" hideNav>
      <DemoViewerSwitch />

      <article
        ref={articleRef}
        tabIndex={-1}
        aria-label="메시지"
        className="flex flex-col items-center gap-3 pt-4 text-center outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {other && <FamilyAvatar member={other} size={88} />}
        <StepLabel>
          {isRecipient ? `${from?.name ?? "가족"} 님의 마음` : `${to?.name ?? "가족"} 님에게 보낸 마음`} ·{" "}
          <time dateTime={message.createdAt} className="tabular-nums">
            {formatFullDate(at)} {formatTime(at)}
          </time>
        </StepLabel>
        <blockquote className="px-1 py-3 text-xl leading-relaxed font-semibold whitespace-pre-wrap">{message.text}</blockquote>
        <div className="flex flex-wrap justify-center gap-1.5">
          <MindStatusBadge status={message.status} />
          {message.seed && <span className="text-xs text-muted-foreground">데모 예시</span>}
        </div>
        <p className="text-sm text-muted-foreground">이 메시지를 읽는 것은 동의나 수락을 의미하지 않아요.</p>
        {message.response && (
          <section aria-label="응답" className="mt-2 flex w-full flex-col gap-1.5 rounded-lg bg-muted p-4 text-left">
            <p className="text-sm font-medium text-muted-foreground">
              {to?.name}의 {RESPONSE_LABEL[message.response.kind]}
            </p>
            {message.response.kind === "reply" && <p className="leading-relaxed whitespace-pre-wrap">{message.response.text}</p>}
            <time className="text-sm text-muted-foreground tabular-nums" dateTime={message.response.at}>
              {formatTime(new Date(message.response.at))}
            </time>
          </section>
        )}
      </article>

      {canRespond && !replyOpen && (
        <section aria-label="응답 선택" className="grid gap-2">
          <Button size="lg" onClick={() => setReplyOpen(true)}>
            <MessageCircle aria-hidden="true" />
            답장하기
          </Button>
          <Button variant="outline" size="lg" onClick={() => setPending({ kind: "later" })}>
            <Clock aria-hidden="true" />
            나중에 이야기하기
          </Button>
          <Button variant="ghost" size="lg" className="text-muted-foreground underline underline-offset-4" onClick={() => setPending({ kind: "declined" })}>
            <Ban aria-hidden="true" />
            지금은 어려워요
          </Button>
        </section>
      )}

      {canRespond && replyOpen && (
        <section aria-label="답장 쓰기" className="flex flex-col gap-2">
          <label htmlFor="mind-reply" className="text-sm font-semibold text-muted-foreground">
            {from?.name}에게 답장
          </label>
          <Textarea
            id="mind-reply"
            value={reply}
            maxLength={MIND_REPLY_MAX_LENGTH}
            rows={4}
            placeholder="짧게라도 괜찮아요."
            aria-describedby="mind-reply-count"
            onChange={(e) => setReply(e.target.value)}
          />
          <p id="mind-reply-count" className="self-end text-sm text-muted-foreground tabular-nums">
            {reply.length} / {MIND_REPLY_MAX_LENGTH}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="lg" onClick={() => setReplyOpen(false)}>
              취소
            </Button>
            <Button size="lg" disabled={replyBlank} onClick={() => setPending({ kind: "reply", text: reply })}>
              답장 확인
            </Button>
          </div>
        </section>
      )}

      {!isRecipient && message.response === null && (
        <p className="text-center text-sm text-muted-foreground">
          {to?.name}이(가) 아직 응답하지 않았어요. 열람 여부는 상태 표시로 알 수 있어요.
        </p>
      )}

      <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent onCloseAutoFocus={returnFocus.onCloseAutoFocus}>
          <DialogHeader>
            <DialogTitle>
              {pending?.kind === "reply" ? "이 답장을 보낼까요?" : pending?.kind === "later" ? "나중에 이야기하기로 할까요?" : "지금은 어렵다고 답할까요?"}
            </DialogTitle>
            <DialogDescription>보낸 뒤에는 바꿀 수 없어요. 상대에게는 응답 내용만 보여요.</DialogDescription>
          </DialogHeader>
          {pending?.kind === "reply" && (
            <p className="rounded-lg bg-muted p-3 text-sm leading-relaxed whitespace-pre-wrap">{pending.text}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              돌아가기
            </Button>
            <Button onClick={commit}>확인하고 보내기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
