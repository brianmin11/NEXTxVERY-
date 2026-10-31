import { Ban, Clock, Eye, MessageCircle, Send, type LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { MindMessageStatus } from "@/lib/mind/types"

/** 상태는 아이콘 + 문구로 표시한다(색만으로 구분하지 않음). 열람은 수락이 아니다. */
export const MIND_STATUS: Record<MindMessageStatus, { label: string; icon: LucideIcon; variant: "secondary" | "outline" }> = {
  sent: { label: "전달됨", icon: Send, variant: "outline" },
  read: { label: "열람함", icon: Eye, variant: "outline" },
  replied: { label: "답장 받음", icon: MessageCircle, variant: "secondary" },
  later: { label: "나중에 이야기하기로", icon: Clock, variant: "secondary" },
  declined: { label: "지금은 어렵다고 답함", icon: Ban, variant: "secondary" },
}

export function MindStatusBadge({ status }: { status: MindMessageStatus }) {
  const s = MIND_STATUS[status]
  const Icon = s.icon
  return (
    <Badge variant={s.variant} className="h-6 gap-1 px-2">
      <Icon aria-hidden="true" />
      {s.label}
    </Badge>
  )
}
