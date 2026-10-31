"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { FamilyAvatar } from "@/components/home/family-avatar"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { formatDate, formatTime } from "@/lib/format"
import { findMember, type Family } from "@/lib/home.fixture"
import type { MindMessage } from "@/lib/mind/types"

import { MindStatusBadge } from "./mind-status"

type MindCardProps = {
  message: MindMessage
  family: Family
  /** "received"면 보낸 사람을, "sent"면 받는 사람을 표시 */
  direction: "received" | "sent"
  onOpen?: () => void
}

/** 목록용 카드. 전달 문장·상대·시각·상태만 보여주고 원문은 존재하지 않는다. */
export function MindCard({ message, family, direction, onOpen }: MindCardProps) {
  const other = findMember(family, direction === "received" ? message.fromId : message.toId)
  const at = new Date(message.createdAt)
  return (
    <Card size="sm" className="py-0">
      <Link
        href={`/inbox/${message.id}`}
        onClick={onOpen}
        className="flex items-start gap-3 rounded-xl px-4 py-3 outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted"
      >
        {other && <FamilyAvatar member={other} size={40} decorative />}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="font-semibold">
              {direction === "received" ? `${other?.name ?? "가족"}이(가) 보냄` : `${other?.name ?? "가족"}에게`}
            </p>
            <time className="text-sm text-muted-foreground tabular-nums" dateTime={message.createdAt}>
              {formatDate(at)} {formatTime(at)}
            </time>
          </div>
          <p className="line-clamp-2 text-base leading-relaxed">{message.text}</p>
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <MindStatusBadge status={message.status} />
            {message.seed && (
              <Badge variant="outline" className="h-6 px-2 text-muted-foreground">
                데모 예시
              </Badge>
            )}
          </div>
        </div>
        <ChevronRight className="mt-2 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
    </Card>
  )
}
