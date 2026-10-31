import { Clock, MapPin } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { MemberStack, type Member } from "@/components/woorijip/member"
import { formatDate, formatTime } from "@/lib/format"

type ScheduleCardProps = {
  title: string
  startsAt: Date
  place?: string
  members: Member[]
  action?: React.ReactNode
}

export function ScheduleCard({ title, startsAt, place, members, action }: ScheduleCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="tabular-nums">
          <time dateTime={startsAt.toISOString()}>{formatDate(startsAt)}</time>
        </CardDescription>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <dt>
              <Clock className="size-4" aria-hidden="true" />
              <span className="sr-only">시간</span>
            </dt>
            <dd className="text-foreground tabular-nums">{formatTime(startsAt)}</dd>
          </div>
          {place && (
            <div className="flex items-center gap-2">
              <dt>
                <MapPin className="size-4" aria-hidden="true" />
                <span className="sr-only">장소</span>
              </dt>
              <dd className="min-w-0 text-foreground">{place}</dd>
            </div>
          )}
        </dl>
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MemberStack members={members} />
            <span>{members.length}명 함께해요</span>
          </div>
          {action}
        </div>
      </CardContent>
    </Card>
  )
}

/** ScheduleCard와 같은 크기의 로딩 자리 */
export function ScheduleCardSkeleton() {
  return (
    <Card aria-hidden="true">
      <CardHeader>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-3/4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-1 h-6 w-28 rounded-full" />
      </CardContent>
    </Card>
  )
}
