"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronRight, Images, MessageCircleHeart } from "lucide-react"

import { useCalendar } from "@/components/calendar/calendar-provider"
import { ChoreCard } from "@/components/chores/chore-card"
import { useChores } from "@/components/chores/chores-provider"
import { useBusyId } from "@/components/chores/chores-screen"
import { useFamily } from "@/components/family/family-provider"
import { MemoryImage } from "@/components/memories/memory-image"
import { memoryAlt } from "@/components/memories/memories-screen"
import { useMemories } from "@/components/memories/memories-provider"
import { Button } from "@/components/ui/button"
import { ListRow, RowList, SectionTitle } from "@/components/woorijip/list-row"
import { EmptyState } from "@/components/woorijip/state-views"
import { HOME_CHORE_LIMIT } from "@/lib/chores/config"
import { findMember } from "@/lib/family/types"
import { HOME_MEMORY_LIMIT } from "@/lib/memories/config"
import { cn } from "@/lib/utils"

import type { HomeSelection } from "./home-selection"

type HomeSummaryProps = {
  onSelect: (selection: HomeSelection, origin?: HTMLElement | null) => void
}

/** 홈에 보여줄 오늘 일정 수. 나머지는 '전체'로 */
const HOME_EVENT_LIMIT = 2

/** 집 장면 아래: 마음 전하기 CTA → 오늘 일정 → 내 할 일 → 최근 추억. Figma의 깔끔한 행 목록. */
export function HomeSummary({ onSelect }: HomeSummaryProps) {
  const { family, viewerId } = useFamily()
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
    <div className="flex flex-col gap-7">
      <Link
        href="/mind"
        className={cn(
          "flex min-h-19 items-center gap-3.5 rounded-xl bg-primary px-4 py-3 text-primary-foreground shadow-raised outline-none",
          "-translate-y-0.5 transition-[transform,box-shadow] hover:bg-primary-deep focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-0.5 active:shadow-raised-pressed"
        )}
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card/15">
          <MessageCircleHeart className="size-6" aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-base font-bold">마음 전하기</span>
          <span className="text-xs text-secondary">말하기 어려운 마음을 천천히 정리해요</span>
        </span>
        <ChevronRight className="size-5 shrink-0" aria-hidden="true" />
      </Link>

      <section className="flex flex-col gap-1" aria-labelledby="home-today">
        <SectionTitle id="home-today" title="오늘 일정" count={todays.length} action={{ label: "전체", href: "/calendar" }} />
        {shown.length === 0 ? (
          <p className="border-t border-border py-4 text-sm text-muted-foreground">아직 등록된 일정이 없어요</p>
        ) : (
          <RowList>
            {shown.map((ev) => {
              const names = ev.participantIds.map((id) => findMember(family, id)?.name).filter(Boolean)
              return (
                <ListRow
                  key={ev.id}
                  onClick={(e) => onSelect({ type: "schedule", id: ev.id }, e.currentTarget)}
                  leading={<span className="w-12 shrink-0 text-sm font-bold whitespace-nowrap text-primary tabular-nums">{ev.allDay ? "종일" : ev.startTime}</span>}
                  title={ev.title}
                  subtitle={names.length > 0 ? names.join(", ") : "참여자 미정"}
                />
              )
            })}
          </RowList>
        )}
        {todays.length > HOME_EVENT_LIMIT && (
          <p className="pt-2 text-sm text-muted-foreground">
            오늘 일정이 {todays.length - HOME_EVENT_LIMIT}개 더 있어요.{" "}
            <Link href="/calendar" className="font-semibold text-primary underline-offset-4 hover:underline">
              전체 보기
            </Link>
          </p>
        )}
      </section>

      <section className="flex flex-col gap-1" aria-labelledby="home-chores">
        <SectionTitle id="home-chores" title="내 할 일" count={myTodos.length} action={{ label: "전체", href: "/chores" }} />
        {choreNotice && (
          <p role="status" className="rounded-lg bg-secondary px-4 py-2 text-sm">
            {choreNotice}
          </p>
        )}
        {myTodos.length === 0 ? (
          <p className="border-t border-border py-4 text-sm text-muted-foreground">맡은 집안일이 없어요</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border border-t border-border">
            {myTodos.slice(0, HOME_CHORE_LIMIT).map((c) => (
              <li key={c.id}>
                <ChoreCard
                  chore={c}
                  family={family}
                  viewerId={viewerId}
                  today={choresState.today}
                  busy={busyId === c.id}
                  onSetStatus={async (id, next) => {
                    if (busyId) return
                    if (await choresState.setStatus(id, next)) {
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
        <SectionTitle id="home-memory" title="최근 추억" action={{ label: "전체", href: "/memories" }} />
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
          <ul className="grid h-24 grid-cols-[1.25fr_1fr_1fr] gap-2">
            {recentMemories.map((post) => {
              const asset = memories.assetById(post.assetId)
              const author = findMember(family, post.authorId)
              if (!asset || !author) return null
              const alt = memoryAlt(post, author.name)
              return (
                <li key={post.id} className="min-h-0">
                  <Link
                    href={`/memories/${post.id}`}
                    aria-label={`${alt} · 상세 보기`}
                    className="block h-full overflow-hidden rounded-lg bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:opacity-90"
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
