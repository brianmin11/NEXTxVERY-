"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CalendarDays, Clock, MapPin, MessageCircleHeart, ShieldCheck, UserRoundPen } from "lucide-react"

import { useCalendar } from "@/components/calendar/calendar-provider"
import { useFamily } from "@/components/family/family-provider"
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
import { formatDateKeyFull, formatEventTime } from "@/lib/calendar/date"
import { findMember, isFamilyAdmin, memberRoleLabel } from "@/lib/family/types"
import { clampSpot, SPOT_STEP } from "@/lib/scene/spots"

import { FamilyAvatar } from "./family-avatar"
import type { HomeSelection } from "./home-selection"

type HomeDetailSheetProps = {
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
export function HomeDetailSheet({ selection, open, onOpenChange, returnFocusRef }: HomeDetailSheetProps) {
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
        {selection && <SheetBody selection={selection} />}
        <SheetFooter className="px-5 pb-5">
          <SheetClose asChild>
            <Button variant="outline" size="lg">
              닫기
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function SheetBody({ selection }: { selection: HomeSelection }) {
  const { family, viewerId, spotOf, moveMember } = useFamily()
  const router = useRouter()
  const mind = useMind()
  const calendar = useCalendar()

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
              <h3 className="text-sm font-semibold text-muted-foreground">함께하는 가족 {members.length}명</h3>
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
      const me = member.id === viewerId
      const spot = spotOf(member.id)
      const move = (dx: number, dy: number) => moveMember(member.id, clampSpot({ x: spot.x + dx, y: spot.y + dy }))
      return (
        <>
          <SheetHeader className="items-center px-5 pt-2 text-center">
            <FamilyAvatar member={member} size={120} />
            <SheetTitle className="text-2xl font-bold">
              {member.name}
              {me && <span className="ml-1.5 text-base font-semibold text-muted-foreground">(나)</span>}
            </SheetTitle>
            <SheetDescription>{memberRoleLabel(family, member)}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-2 px-5">
            {me ? (
              <Button size="lg" className="w-full" asChild>
                <Link href="/me/character">
                  <UserRoundPen aria-hidden="true" />
                  내 캐릭터 바꾸기
                </Link>
              </Button>
            ) : (
              <Button
                size="lg"
                className="w-full"
                onClick={() => {
                  // 수신자만 미리 고른다. 이 동작으로 보내지지 않는다.
                  mind.dispatch({ type: "draft/update", patch: { recipientId: member.id } })
                  router.push("/mind")
                }}
              >
                <MessageCircleHeart aria-hidden="true" />
                {member.name}에게 마음 전하기
              </Button>
            )}
            <fieldset className="flex flex-col gap-2 pt-2">
              <legend className="text-sm font-semibold text-muted-foreground">마당에서 위치 옮기기</legend>
              <div className="grid grid-cols-4 gap-2">
                <Button variant="outline" aria-label="왼쪽으로" onClick={() => move(-SPOT_STEP.x * 2, 0)}>
                  <ArrowLeft aria-hidden="true" />
                </Button>
                <Button variant="outline" aria-label="오른쪽으로" onClick={() => move(SPOT_STEP.x * 2, 0)}>
                  <ArrowRight aria-hidden="true" />
                </Button>
                <Button variant="outline" aria-label="뒤로(집 쪽으로)" onClick={() => move(0, -SPOT_STEP.y * 2)}>
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button variant="outline" aria-label="앞으로" onClick={() => move(0, SPOT_STEP.y * 2)}>
                  <ArrowDown aria-hidden="true" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                끌어서 옮기기 어려우면 이 버튼이나 캐릭터에 포커스한 뒤 방향키를 쓰세요. 위치는 화면 연출일 뿐 저장되지 않아요.
              </p>
            </fieldset>
          </div>
        </>
      )
    }

    case "family":
      return (
        <>
          <SheetHeader className="px-5 pt-2">
            <span className="text-xs font-bold tracking-wide text-primary">가족 구성원</span>
            <SheetTitle className="pr-10 text-xl font-bold">
              {family.name}의 {family.members.length}명
            </SheetTitle>
            <SheetDescription>관리자 표시는 가족 역할(엄마·아빠)과 별개예요.</SheetDescription>
          </SheetHeader>
          <ul className="flex flex-col divide-y divide-border border-t border-border px-5">
            {family.members.map((m) => (
              <li key={m.id} className="flex min-h-17 items-center gap-3 py-2">
                <FamilyAvatar member={m} size={44} decorative />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {m.name}
                    {m.id === viewerId && <span className="ml-1 text-sm font-medium text-muted-foreground">(나)</span>}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{memberRoleLabel(family, m)}</p>
                </div>
                {isFamilyAdmin(family, m.id) && (
                  <ShieldCheck className="size-5 shrink-0 text-primary" aria-label="가족 관리자" />
                )}
              </li>
            ))}
          </ul>
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
