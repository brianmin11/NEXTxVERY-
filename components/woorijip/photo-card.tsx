import { ImageIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { MemberAvatar, type Member } from "@/components/woorijip/member"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

type PhotoCardProps = {
  caption: string
  /** 시각(Date). 날짜 전용 값이면 dateLabel/dateTime을 대신 준다 */
  takenAt?: Date
  dateLabel?: string
  dateTime?: string
  uploader: Member
  /** 실제 이미지가 연결되면 이 자리에 넣는다. */
  media?: React.ReactNode
  /** 목록 타일은 정사각형, 기본은 4:3 */
  aspect?: "4/3" | "square"
  /** 예: '예시' */
  badge?: string
}

/** 사진 카드 틀. 이미지 영역 비율을 고정해 레이아웃이 밀리지 않게 한다. */
export function PhotoCard({ caption, takenAt, dateLabel, dateTime, uploader, media, aspect = "4/3", badge }: PhotoCardProps) {
  const label = dateLabel ?? (takenAt ? formatDate(takenAt) : null)
  const time = dateTime ?? takenAt?.toISOString()
  return (
    <Card className="gap-0 pt-0 pb-0">
      <div className={cn("relative w-full overflow-hidden bg-muted", aspect === "square" ? "aspect-square" : "aspect-[4/3]")}>
        {media ?? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageIcon className="size-8" aria-hidden="true" />
            <span className="text-sm">사진이 들어갈 자리</span>
          </div>
        )}
        {badge && (
          <Badge variant="outline" className="absolute top-2 left-2 h-6 bg-card/90 px-2 text-muted-foreground">
            {badge}
          </Badge>
        )}
      </div>
      <CardContent className="gap-2 py-4">
        <p className="line-clamp-2 font-medium">{caption}</p>
        <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <MemberAvatar member={uploader} size="sm" />
          <span className="truncate" aria-hidden="true">
            {uploader.name}
          </span>
          {label && (
            <>
              <span aria-hidden="true">·</span>
              <time className="shrink-0 tabular-nums" dateTime={time}>
                {label}
              </time>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
