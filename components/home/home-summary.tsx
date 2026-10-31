"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronRight, Heart, Images } from "lucide-react"

import { useCalendar } from "@/components/calendar/calendar-provider"
import { ChoreCard } from "@/components/chores/chore-card"
import { useChores } from "@/components/chores/chores-provider"
import { useBusyId } from "@/components/chores/chores-screen"
import { useDemoViewer } from "@/components/demo/demo-viewer-provider"
import { MemoryImage } from "@/components/memories/memory-image"
import { memoryAlt } from "@/components/memories/memories-screen"
import { useMemories } from "@/components/memories/memories-provider"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { MemberStack } from "@/components/woorijip/member"
import { EmptyState } from "@/components/woorijip/state-views"
import { formatEventTime } from "@/lib/calendar/date"
import { findMember, type HomeData } from "@/lib/home.fixture"
import { HOME_CHORE_LIMIT } from "@/lib/chores/config"
import { HOME_MEMORY_LIMIT } from "@/lib/memories/config"

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
  const { family } = data
  const { viewerId } = useDemoViewer()
  const cal = useCalendar()
  const memories = useMemories()
  const choresState = useChores()
  const { busyId, mark } = useBusyId()
  const [choreNotice, setChoreNotice] = React.useState<string | null>(null)
  const todays = cal.eventsOn(cal.today)
  const shown = todays.slice(0, HOME_EVENT_LIMIT)
  // 현재 데모 인물이 담당한 미완료 집안일(날짜순). 인물이 바뀌면 함께 바뀐다.
  const myTodos = choresState.listChores("todo", true)
  // 홈은 등록 시각 내림차순으로 최근 것만
  const recentMemories = memories.recentPosts.slice(0, HOME_MEMORY_LIMIT)

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
        <div className="flex items-center justify-between gap-2">
          <SectionTitle>
            <span id="home-chores">내 할 일</span>
            {myTodos.length > 0 && <span className="ml-1 tabular-nums">{myTodos.length}</span>}
          </SectionTitle>
          <Button variant="link" className="-mr-2 h-11 px-2 text-sm" asChild>
            <Link href="/chores">전체 보기</Link>
          </Button>
        </div>
        {choreNotice && (
          <p role="status" className="rounded-xl bg-secondary px-4 py-2 text-sm">
            {choreNotice}
          </p>
        )}
        {myTodos.length === 0 ? (
          <p className="rounded-xl bg-card px-4 py-3 text-sm text-muted-foreground ring-1 ring-border">맡은 집안일이 없어요</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {myTodos.slice(0, HOME_CHORE_LIMIT).map((c) => (
              <li key={c.id}>
                <ChoreCard
                  chore={c}
                  family={family}
                  viewerId={viewerId}
                  today={choresState.today}
                  busy={busyId === c.id}
                  onSetStatus={(id, next) => {
                    if (busyId) return
                    if (choresState.setStatus(id, next)) {
                      mark(id)
                      setChoreNotice(next === "done" ? "완료로 표시했어요" : "완료를 취소했어요")
                    }
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="home-memory">
        <div className="flex items-center justify-between gap-2">
          <SectionTitle>
            <span id="home-memory">최근 추억</span>
          </SectionTitle>
          <Button variant="link" className="-mr-2 h-11 px-2 text-sm" asChild>
            <Link href="/memories">전체 보기</Link>
          </Button>
        </div>
        {recentMemories.length === 0 ? (
          <EmptyState
            icon={Images}
            title="아직 추억이 없어요"
            description="첫 사진을 올려 보세요."
            action={
              <Button asChild>
                <Link href="/memories/new">추억 등록</Link>
              </Button>
            }
          />
        ) : (
          <ul className="grid grid-cols-3 gap-2">
            {recentMemories.map((post) => {
              const asset = memories.assetById(post.assetId)
              const author = findMember(family, post.authorId)
              if (!asset || !author) return null
              const alt = memoryAlt(post, author.name)
              return (
                <li key={post.id}>
                  <Link
                    href={`/memories/${post.id}`}
                    aria-label={`${alt} · 상세 보기`}
                    className="block aspect-square overflow-hidden rounded-xl bg-muted ring-1 ring-border outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:opacity-90"
                  >
                    <MemoryImage asset={asset} alt="" fit="cover" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
