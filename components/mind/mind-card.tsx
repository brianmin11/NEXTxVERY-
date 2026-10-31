"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { MemberAvatar } from "@/components/woorijip/member"
import { formatDate, formatTime } from "@/lib/format"
import { findMember, type Family } from "@/lib/home.fixture"
import type { MindMessage } from "@/lib/mind/types"

import { MindStatusBadge } from "./mind-status"

type MindCardProps = {
  message: MindMessage
  family: Family
  /** "received"면 보낸 사람을, "sent"면 받는 사람을 표시 */
  direction: "received" | "sent"
}

/**
 * 수신함 행. 전달 문장·상대·시각·상태만 보여주고 원문은 존재하지 않는다.
 * 읽음 처리는 상세 화면 진입 시 한 곳에서만 일어난다(카드 클릭·URL 직접 진입 모두 같은 경로).
 */
export function MindCard({ message, family, direction }: MindCardProps) {
  const other = findMember(family, direction === "received" ? message.fromId : message.toId)
  const at = new Date(message.createdAt)
  const unread = direction === "received" && message.status === "sent"
  return (
    <li className="flex">
      <Link
        href={`/inbox/${message.id}`}
        className="flex min-h-24 w-full items-center gap-3 px-1 py-3 outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset active:bg-muted"
      >
        {other ? (
          <MemberAvatar member={other} size="lg" className="size-12 text-base" />
        ) : (
          <span className="size-12 rounded-full bg-muted" aria-hidden="true" />
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate text-muted-foreground">
              {direction === "received" ? `${other?.name ?? "가족"}` : `${other?.name ?? "가족"}에게`}
            </span>
            <time className="shrink-0 text-xs text-muted-foreground tabular-nums" dateTime={message.createdAt}>
              {formatDate(at)} {formatTime(at)}
            </time>
          </span>
          <span className={`line-clamp-2 leading-snug ${unread ? "font-bold" : "font-medium"}`}>{message.text}</span>
          <span className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {unread ? <span className="text-xs font-semibold text-primary">새로운 마음</span> : <MindStatusBadge status={message.status} />}
            {message.seed && <span className="text-xs text-muted-foreground">데모 예시</span>}
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
    </li>
  )
}
