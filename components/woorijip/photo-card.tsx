import { ImageIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { MemberAvatar, type Member } from "@/components/woorijip/member"
import { formatDate } from "@/lib/format"

type PhotoCardProps = {
  caption: string
  takenAt: Date
  uploader: Member
  /** 실제 이미지가 연결되면 이 자리에 next/image를 넣는다. */
  media?: React.ReactNode
}

/** 사진 카드 틀. 이미지 영역은 4:3으로 고정해 레이아웃이 밀리지 않게 한다. */
export function PhotoCard({ caption, takenAt, uploader, media }: PhotoCardProps) {
  return (
    <Card className="gap-0 pt-0 pb-0">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {media ?? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageIcon className="size-8" aria-hidden="true" />
            <span className="text-sm">사진이 들어갈 자리</span>
          </div>
        )}
      </div>
      <CardContent className="gap-2 py-4">
        <p className="line-clamp-2 font-medium">{caption}</p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MemberAvatar member={uploader} size="sm" />
          <span aria-hidden="true">{uploader.name}</span>
          <span aria-hidden="true">·</span>
          <time className="tabular-nums" dateTime={takenAt.toISOString()}>
            {formatDate(takenAt)}
          </time>
        </div>
      </CardContent>
    </Card>
  )
}
