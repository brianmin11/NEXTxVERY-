"use client"

import { Bell, Clock, Heart, MapPin } from "lucide-react"

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
import { formatFullDate, formatTime } from "@/lib/format"
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

  switch (selection.type) {
    case "schedule": {
      const item = data.schedules.find((s) => s.id === selection.id)
      if (!item) return <MissingBody />
      const date = new Date(item.startsAt)
      const members = item.memberIds.map((id) => findMember(family, id)).filter((m) => m !== undefined)
      return (
        <>
          <SheetHeader className="px-5 pt-2">
            <SheetTitle className="pr-10 text-xl font-bold">{item.title}</SheetTitle>
            <SheetDescription className="tabular-nums">
              <time dateTime={item.startsAt}>{formatFullDate(date)}</time>
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-5">
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2">
                <dt className="text-muted-foreground">
                  <Clock className="size-4" aria-hidden="true" />
                  <span className="sr-only">시간</span>
                </dt>
                <dd className="tabular-nums">{formatTime(date)}</dd>
              </div>
              {item.place && (
                <div className="flex items-center gap-2">
                  <dt className="text-muted-foreground">
                    <MapPin className="size-4" aria-hidden="true" />
                    <span className="sr-only">장소</span>
                  </dt>
                  <dd>{item.place}</dd>
                </div>
              )}
            </dl>
            {item.note && <p className="leading-relaxed">{item.note}</p>}
            <section aria-label="참여하는 가족" className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-muted-foreground">함께하는 가족 {members.length}명</h3>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <MemberChip key={m.id} member={m} />
                ))}
              </div>
            </section>
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
          <div className="px-5">
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

    case "heart":
      return (
        <>
          <SheetHeader className="px-5 pt-2">
            <SheetTitle className="flex items-center gap-2 pr-10 text-xl font-bold">
              <Heart className="size-5 text-primary" aria-hidden="true" />
              마음 전하기
            </SheetTitle>
            <SheetDescription>다음 단계에서 연결할 화면이에요.</SheetDescription>
          </SheetHeader>
          <p className="px-5 leading-relaxed">
            여기서 나만 보는 원문을 쓰고, 전달할 문장을 다듬은 뒤 직접 확인하고 보내게 돼요. 지금은 입력과 전송이
            되지 않아요.
          </p>
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
