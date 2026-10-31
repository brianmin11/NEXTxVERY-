"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bell, CalendarDays, Clock, Heart, Inbox, MapPin } from "lucide-react"

import { useCalendar } from "@/components/calendar/calendar-provider"
import { useMind } from "@/components/mind/mind-provider"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { MemberChip } from "@/components/woorijip/member"
import { EmptyState } from "@/components/woorijip/state-views"
import { formatDateKeyFull, formatEventTime } from "@/lib/calendar/date"
import { formatTime } from "@/lib/format"
import { findMember, type HomeData } from "@/lib/home.fixture"

import { FamilyAvatar } from "./family-avatar"
import type { HomeSelection } from "./home-selection"

type HomeDetailSheetProps = {
  data: HomeData
  selection: HomeSelection | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 시트를 연 요소. 닫힐 때 여기로 포커스를 돌려준다. */
  returnFocusRef: React.RefObject<HTMLElement | null>
}

/**
 * 홈의 모든 짧은 상세를 담는 단일 바텀시트.
 * selection은 닫히는 동안에도 유지해 내용이 사라지며 깜빡이지 않게 한다.
 * 트리거 없이 여는 모달이라 Radix 기본 복귀가 동작하지 않으므로 직접 포커스를 돌려준다.
 */
export function HomeDetailSheet({ data, selection, open, onOpenChange, returnFocusRef }: HomeDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        onCloseAutoFocus={(event) => {
          const target = returnFocusRef.current
          if (target && target.isConnected) {
            event.preventDefault()
            target.focus()
          }
        }}
      >
        <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" />
        {selection && <SheetBody data={data} selection={selection} />}
        <SheetFooter className="px-5 pb-5">
          <SheetClose asChild>
            <Button variant="secondary" size="lg">
              닫기
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function SheetBody({ data, selection }: { data: HomeData; selection: HomeSelection }) {
  const { family } = data
  const router = useRouter()
  const mind = useMind()
  const calendar = useCalendar()
  const receivedCount = mind.messages.filter((m) => m.toId === mind.viewerId).length

  switch (selection.type) {
    case "schedule": {
      // 캘린더 상태를 그대로 읽는다. 수정·삭제는 /calendar에서 한다.
      const item = calendar.eventById(selection.id)
      if (!item) return <MissingBody />
      const members = item.participantIds.map((id) => findMember(family, id)).filter((m) => m !== undefined)
      return (
        <>
          <SheetHeader className="px-5 pt-2">
            <SheetTitle className="pr-10 text-xl font-bold">{item.title}</SheetTitle>
            <SheetDescription className="tabular-nums">
              <time dateTime={item.date}>{formatDateKeyFull(item.date)}</time>
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-5">
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2">
                <dt className="text-muted-foreground">
                  <Clock className="size-4" aria-hidden="true" />
                  <span className="sr-only">시간</span>
                </dt>
                <dd className="tabular-nums">{formatEventTime(item)}</dd>
              </div>
              {item.location && (
                <div className="flex items-center gap-2">
                  <dt className="text-muted-foreground">
                    <MapPin className="size-4" aria-hidden="true" />
                    <span className="sr-only">장소</span>
                  </dt>
                  <dd>{item.location}</dd>
                </div>
              )}
            </dl>
            {item.memo && <p className="leading-relaxed whitespace-pre-wrap">{item.memo}</p>}
            <section aria-label="참여하는 가족" className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-muted-foreground">함께하는 가족 {members.length}명</h3>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <MemberChip key={m.id} member={m} />
                ))}
              </div>
            </section>
            <Button variant="outline" size="lg" className="w-full" asChild>
              <Link href="/calendar">
                <CalendarDays aria-hidden="true" />
                캘린더에서 보기
              </Link>
            </Button>
          </div>
        </>
      )
    }

    case "member": {
      const member = findMember(family, selection.id)
      if (!member) return <MissingBody />
      return (
        <>
          <SheetHeader className="px-5 pt-2">
            <SheetTitle className="pr-10 text-xl font-bold">{member.name}</SheetTitle>
            <SheetDescription>{member.role ?? "구성원"}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col items-center gap-4 px-5">
            <FamilyAvatar member={member} size={120} />
            {member.id !== mind.viewerId && (
              <Button
                size="lg"
                className="w-full"
                onClick={() => {
                  // 수신자만 미리 고른다. 이 동작으로 보내지지 않는다.
                  mind.dispatch({ type: "draft/update", patch: { recipientId: member.id } })
                  router.push("/mind")
                }}
              >
                <Heart aria-hidden="true" />
                {member.name}에게 마음 전하기
              </Button>
            )}
            <p className="text-sm text-muted-foreground">캐릭터 꾸미기는 다음 단계에서 만들어요.</p>
          </div>
        </>
      )
    }

    case "family":
      return (
        <>
          <SheetHeader className="px-5 pt-2">
            <SheetTitle className="pr-10 text-xl font-bold">{family.name}</SheetTitle>
            <SheetDescription>가족 {family.members.length}명</SheetDescription>
          </SheetHeader>
          <ul className="flex flex-col gap-3 px-5">
            {family.members.map((m) => (
              <li key={m.id} className="flex min-w-0 items-center gap-3">
                <FamilyAvatar member={m} size={44} decorative />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{m.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{m.role ?? "구성원"}</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )

    case "notifications":
      return (
        <>
          <SheetHeader className="px-5 pt-2">
            <SheetTitle className="pr-10 text-xl font-bold">알림</SheetTitle>
            <SheetDescription>가상 알림이에요. 실제로 저장되지 않아요.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-3 px-5">
            <Button variant="secondary" size="lg" className="w-full" asChild>
              <Link href="/inbox">
                <Inbox aria-hidden="true" />
                마음 수신함 열기{receivedCount > 0 && <span className="tabular-nums">· 받은 마음 {receivedCount}</span>}
              </Link>
            </Button>
            {data.notifications.length === 0 ? (
              <EmptyState icon={Bell} title="새 알림이 없어요" description="가족의 소식이 오면 여기에 보여요." />
            ) : (
              <ul className="flex flex-col divide-y divide-border rounded-xl bg-card ring-1 ring-border">
                {data.notifications.map((n) => (
                  <li key={n.id} className="flex flex-col gap-0.5 px-4 py-3">
                    <p>{n.text}</p>
                    <time className="text-sm text-muted-foreground tabular-nums" dateTime={n.at}>
                      {formatTime(new Date(n.at))}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )

  }
}

function MissingBody() {
  return (
    <SheetHeader className="px-5 pt-2">
      <SheetTitle className="pr-10 text-xl font-bold">내용을 찾을 수 없어요</SheetTitle>
      <SheetDescription>이미 지워졌거나 잘못된 항목이에요.</SheetDescription>
    </SheetHeader>
  )
}
