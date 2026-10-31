"use client"

import Link from "next/link"
import { ChevronRight, Circle, CircleCheck, Heart, Images } from "lucide-react"

import { useCalendar } from "@/components/calendar/calendar-provider"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { MemberStack } from "@/components/woorijip/member"
import { PhotoCard } from "@/components/woorijip/photo-card"
import { EmptyState } from "@/components/woorijip/state-views"
import { formatEventTime } from "@/lib/calendar/date"
import { findMember, type HomeData } from "@/lib/home.fixture"

import type { HomeSelection } from "./home-selection"

type HomeSummaryProps = {
  data: HomeData
  onSelect: (selection: HomeSelection, origin?: HTMLElement | null) => void
}

/** 홈에 보여줄 오늘 일정 수. 나머지는 '전체 보기'로 */
const HOME_EVENT_LIMIT = 2

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold text-muted-foreground">{children}</h2>
}

/** 집 장면 아래: CTA → 오늘 일정(캘린더 상태) → 내 할 일 → 최근 추억. 한 열, 항목마다 밀도를 다르게 둔다. */
export function HomeSummary({ data, onSelect }: HomeSummaryProps) {
  const { family, chores, memories } = data
  const cal = useCalendar()
  const todays = cal.eventsOn(cal.today)
  const shown = todays.slice(0, HOME_EVENT_LIMIT)
  const myChores = chores.filter((c) => c.assigneeId === data.viewerId).slice(0, 2)
  const latestMemory = memories[0]
  const uploader = latestMemory ? findMember(family, latestMemory.uploaderId) : undefined

  return (
    <div className="flex flex-col gap-6">
      <Button size="lg" className="w-full" asChild>
        <Link href="/mind">
          <Heart aria-hidden="true" />
          마음 전하기
        </Link>
      </Button>

      <section className="flex flex-col gap-2" aria-labelledby="home-today">
        <div className="flex items-center justify-between gap-2">
          <SectionTitle>
            <span id="home-today">오늘 일정</span>
            {todays.length > 0 && <span className="ml-1 tabular-nums">{todays.length}</span>}
          </SectionTitle>
          <Button variant="link" className="-mr-2 h-11 px-2 text-sm" asChild>
            <Link href="/calendar">전체 보기</Link>
          </Button>
        </div>
        {shown.length === 0 ? (
          <p className="rounded-xl bg-card px-4 py-3 text-sm text-muted-foreground ring-1 ring-border">
            아직 등록된 일정이 없어요
          </p>
        ) : (
          <Card size="sm" className="gap-0 py-0">
            <ul>
              {shown.map((ev, i) => {
                const members = ev.participantIds.map((id) => findMember(family, id)).filter((m) => m !== undefined)
                return (
                  <li key={ev.id}>
                    {i > 0 && <Separator />}
                    <Button
                      variant="ghost"
                      className="h-auto w-full justify-start gap-3 rounded-none px-4 py-3 text-left whitespace-normal"
                      onClick={(e) => onSelect({ type: "schedule", id: ev.id }, e.currentTarget)}
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-sm text-muted-foreground tabular-nums">{formatEventTime(ev)}</span>
                        <span className="font-semibold">{ev.title}</span>
                      </span>
                      {members.length > 0 && <MemberStack members={members} max={3} />}
                      <ChevronRight className="text-muted-foreground" aria-hidden="true" />
                    </Button>
                  </li>
                )
              })}
            </ul>
          </Card>
        )}
        {todays.length > HOME_EVENT_LIMIT && (
          <p className="text-sm text-muted-foreground">
            오늘 일정이 {todays.length - HOME_EVENT_LIMIT}개 더 있어요.{" "}
            <Link href="/calendar" className="font-medium text-primary underline-offset-4 hover:underline">
              전체 보기
            </Link>
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="home-chores">
        <SectionTitle>
          <span id="home-chores">내 할 일</span>
        </SectionTitle>
        {myChores.length === 0 ? (
          <p className="text-sm text-muted-foreground">오늘 맡은 집안일이 없어요</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {myChores.map((c) => (
              <li key={c.id} className="flex min-h-11 items-center gap-3 rounded-xl bg-card px-4 ring-1 ring-border">
                {c.done ? (
                  <CircleCheck className="size-5 shrink-0 text-primary" aria-hidden="true" />
                ) : (
                  <Circle className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <span className={c.done ? "text-muted-foreground line-through" : undefined}>{c.title}</span>
                <span className="sr-only">{c.done ? "완료" : "아직 안 함"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="home-memory">
        <SectionTitle>
          <span id="home-memory">최근 추억</span>
        </SectionTitle>
        {latestMemory && uploader ? (
          <PhotoCard caption={latestMemory.caption} takenAt={new Date(latestMemory.takenAt)} uploader={uploader} />
        ) : (
          <EmptyState
            icon={Images}
            title="아직 추억이 없어요"
            description="첫 사진은 다음 단계에서 올릴 수 있어요."
          />
        )}
      </section>
    </div>
  )
}
