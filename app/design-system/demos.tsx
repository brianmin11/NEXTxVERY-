"use client"

import * as React from "react"
import { CalendarDays, Loader2, RotateCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ScheduleCard, ScheduleCardSkeleton } from "@/components/woorijip/schedule-card"
import { ErrorState } from "@/components/woorijip/state-views"
import type { Member } from "@/components/woorijip/member"
import { MemberChip } from "@/components/woorijip/member"
import { formatFullDate, formatTime } from "@/lib/format"

/** 저장 버튼을 눌렀을 때의 loading 상태 미리보기(가상 지연). */
export function LoadingButtonDemo() {
  const [loading, setLoading] = React.useState(false)

  function handleClick() {
    setLoading(true)
    window.setTimeout(() => setLoading(false), 1500)
  }

  return (
    <Button onClick={handleClick} disabled={loading} aria-busy={loading}>
      {loading && <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />}
      {loading ? "저장하는 중" : "눌러서 loading 보기"}
    </Button>
  )
}

/** 오류 → 재시도 → 로딩(skeleton) → 성공 흐름 미리보기(가상 데이터). */
export function RetryDemo({ members, startsAt }: { members: Member[]; startsAt: string }) {
  const [state, setState] = React.useState<"error" | "loading" | "done">("error")

  function retry() {
    setState("loading")
    window.setTimeout(() => setState("done"), 1200)
  }

  return (
    <div aria-live="polite" className="flex flex-col gap-3">
      {state === "error" && (
        <ErrorState
          title="일정을 불러오지 못했어요"
          description="인터넷 연결을 확인하고 다시 시도해 주세요."
          action={
            <Button variant="outline" onClick={retry}>
              <RotateCw aria-hidden="true" />
              다시 시도
            </Button>
          }
        />
      )}
      {state === "loading" && (
        <>
          <span className="sr-only">일정을 불러오는 중</span>
          <ScheduleCardSkeleton />
        </>
      )}
      {state === "done" && (
        <>
          <ScheduleCard
            title="오늘 저녁 7시, 함께 식사해요"
            startsAt={new Date(startsAt)}
            place="우리집 거실"
            members={members}
          />
          <Button variant="ghost" className="self-start" onClick={() => setState("error")}>
            오류 상태로 되돌리기
          </Button>
        </>
      )}
    </div>
  )
}

/** 짧은 상세는 바텀시트. 닫으면 포커스가 열었던 버튼으로 돌아온다(Radix 기본 동작). */
export function SheetDemo({ members, startsAt }: { members: Member[]; startsAt: string }) {
  const date = new Date(startsAt)
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="w-full">
          <CalendarDays aria-hidden="true" />
          일정 자세히 보기
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom">
        <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" />
        <SheetHeader className="px-5 pt-2">
          <SheetTitle className="pr-10 text-xl font-bold">오늘 저녁 7시, 함께 식사해요</SheetTitle>
          <SheetDescription className="tabular-nums">
            {formatFullDate(date)} · {formatTime(date)} · 우리집 거실
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-5">
          <p>할머니 생신 전에 미리 모여서 메뉴를 정해요. 늦으면 가족방에 먼저 알려 주세요.</p>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => (
              <MemberChip key={m.id} member={m} />
            ))}
          </div>
        </div>
        <SheetFooter className="px-5 pb-5">
          <Button size="lg">참여할게요</Button>
          <SheetClose asChild>
            <Button variant="ghost" size="lg">
              닫기
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
