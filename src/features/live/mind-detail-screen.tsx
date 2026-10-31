"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Ban, Clock, MessageCircle, SearchX } from "lucide-react"

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
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { AppShell, DemoBadge } from "@/components/woorijip/app-shell"
import { EmptyState } from "@/components/woorijip/state-views"
import { formatFullDate, formatTime } from "@/lib/format"
import { findMember } from "@/lib/home.fixture"
import { MIND_REPLY_MAX_LENGTH } from "@/lib/mind/config"
import type { MindResponse } from "@/lib/mind/types"

import { DemoViewerSwitch } from "@/components/mind/demo-viewer-switch"
import { useMind } from "./mind-provider"
import { MindStatusBadge } from "@/components/mind/mind-status"
import { useReturnFocus } from "@/components/mind/use-return-focus"

type PendingAction =
  | { kind: "reply"; text: string }
  | { kind: "later" }
  | { kind: "declined" }
  | null

const RESPONSE_LABEL: Record<MindResponse["kind"], string> = {
  reply: "답장",
  later: "나중에 이야기하기로 했어요",
  declined: "지금은 어렵다고 답했어요",
}

/** 메시지 상세. 받은 사람만 응답할 수 있고(데모 인물 기준), 열람은 응답과 구분된다. */
export function MindDetailScreen({ id }: { id: string }) {
  const router = useRouter()
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

  const markRead = React.useEffectEvent(() => {
    void dispatch({ type: "message/read", id })
  })
  React.useEffect(() => {
    if (message?.toId === viewerId && message.status === "sent") markRead()
  }, [id, message?.status, message?.toId, viewerId])
  const header = (
    <Button
      variant="ghost"
      size="icon"
      aria-label="수신함으로 돌아가기"
      onClick={() => router.push("/inbox")}
    >
      <ArrowLeft className="size-5" aria-hidden="true" />
    </Button>
  )

  if (!message || (message.toId !== viewerId && message.fromId !== viewerId)) {
    return (
      <AppShell title={header}>
        <DemoBadge />
        <DemoViewerSwitch />
        <EmptyState
          icon={SearchX}
          title="이 인물에게는 보이지 않는 메시지예요"
          description="삭제됐거나 접근할 수 없는 메시지예요."
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
  const at = new Date(message.createdAt)
  const canRespond = isRecipient && message.response === null
  const replyBlank = reply.trim().length === 0

  async function commit() {
    if (!pending || !message) return
    const atNow = new Date().toISOString()
    const response: MindResponse =
      pending.kind === "reply"
        ? { kind: "reply", text: pending.text.trim(), at: atNow }
        : { kind: pending.kind, at: atNow }
    if (
      !(await dispatch({ type: "message/respond", id: message.id, response }))
    )
      return
    setPending(null)
    setReplyOpen(false)
    setReply("")
  }

  return (
    <AppShell title={header}>
      <DemoBadge />
      <DemoViewerSwitch />

      <article
        ref={articleRef}
        tabIndex={-1}
        aria-label="메시지"
        className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-border outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div className="flex items-center gap-3">
          {from && <FamilyAvatar member={from} size={44} decorative />}
          <div className="min-w-0">
            <p className="font-semibold">
              {from?.name} → {to?.name}
            </p>
            <time
              className="text-sm text-muted-foreground tabular-nums"
              dateTime={message.createdAt}
            >
              {formatFullDate(at)} {formatTime(at)}
            </time>
          </div>
        </div>
        <p className="text-lg leading-relaxed whitespace-pre-wrap">
          {message.text}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <MindStatusBadge status={message.status} />
        </div>
        {message.response && (
          <>
            <Separator />
            <section aria-label="응답" className="flex flex-col gap-1.5">
              <p className="text-sm font-medium text-muted-foreground">
                {to?.name}의 {RESPONSE_LABEL[message.response.kind]}
              </p>
              {message.response.kind === "reply" && (
                <p className="rounded-lg bg-muted p-3 leading-relaxed whitespace-pre-wrap">
                  {message.response.text}
                </p>
              )}
              <time
                className="text-sm text-muted-foreground tabular-nums"
                dateTime={message.response.at}
              >
                {formatTime(new Date(message.response.at))}
              </time>
            </section>
          </>
        )}
      </article>

      {canRespond && !replyOpen && (
        <section aria-label="응답 선택" className="grid gap-2">
          <Button size="lg" onClick={() => setReplyOpen(true)}>
            <MessageCircle aria-hidden="true" />
            답장하기
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="lg"
              onClick={() => setPending({ kind: "later" })}
            >
              <Clock aria-hidden="true" />
              나중에 이야기하기
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => setPending({ kind: "declined" })}
            >
              <Ban aria-hidden="true" />
              지금은 어려워요
            </Button>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            열어 본 것만으로는 수락한 것으로 표시되지 않아요.
          </p>
        </section>
      )}

      {canRespond && replyOpen && (
        <section aria-label="답장 쓰기" className="flex flex-col gap-2">
          <label
            htmlFor="mind-reply"
            className="text-sm font-semibold text-muted-foreground"
          >
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
          <p
            id="mind-reply-count"
            className="self-end text-sm text-muted-foreground tabular-nums"
          >
            {reply.length} / {MIND_REPLY_MAX_LENGTH}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="lg"
              onClick={() => setReplyOpen(false)}
            >
              취소
            </Button>
            <Button
              size="lg"
              disabled={replyBlank}
              onClick={() => setPending({ kind: "reply", text: reply })}
            >
              답장 확인
            </Button>
          </div>
        </section>
      )}

      {!isRecipient && message.response === null && (
        <p className="text-sm text-muted-foreground">
          {to?.name}이(가) 아직 응답하지 않았어요. 열람 여부는 상태 표시로 알 수
          있어요.
        </p>
      )}

      <Dialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
      >
        <DialogContent onCloseAutoFocus={returnFocus.onCloseAutoFocus}>
          <DialogHeader>
            <DialogTitle>
              {pending?.kind === "reply"
                ? "이 답장을 보낼까요?"
                : pending?.kind === "later"
                  ? "나중에 이야기하기로 할까요?"
                  : "지금은 어렵다고 답할까요?"}
            </DialogTitle>
            <DialogDescription>
              수신함에만 반영돼요. 실제 알림은 보내지 않고, 보낸 뒤에는 바꿀 수
              없어요.
            </DialogDescription>
          </DialogHeader>
          {pending?.kind === "reply" && (
            <p className="rounded-lg bg-muted p-3 text-sm leading-relaxed whitespace-pre-wrap">
              {pending.text}
            </p>
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
