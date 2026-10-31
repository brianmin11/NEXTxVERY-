"use client"

import * as React from "react"
import Link from "next/link"
import { Bell, ChevronRight, UsersRound } from "lucide-react"

import { useFamily } from "@/components/family/family-provider"
import { useMind } from "@/components/mind/mind-provider"
import { Button } from "@/components/ui/button"
import { AppShell } from "@/components/woorijip/app-shell"

import { HomeDetailSheet } from "./home-detail-sheet"
import type { HomeSelection } from "./home-selection"
import { HomeSummary } from "./home-summary"
import { PixelScene } from "./pixel-scene"

/**
 * 가족 홈. 위는 게임형 픽셀 장면, 아래는 깔끔한 요약 목록이다.
 * 시트는 selection 하나로만 열려 겹치지 않는다.
 */
export function HomeScreen() {
  const { family, viewerId, spotOf, moveMember } = useFamily()
  const { messages } = useMind()
  const [selection, setSelection] = React.useState<HomeSelection | null>(null)
  const [open, setOpen] = React.useState(false)
  // 시트를 연 요소. 트리거 없이 여는 모달은 Radix가 포커스를 돌려주지 않아 직접 기억한다.
  const returnFocusRef = React.useRef<HTMLElement | null>(null)
  const unread = messages.filter((m) => m.toId === viewerId && m.status === "sent").length

  const select = React.useCallback((next: HomeSelection, origin?: HTMLElement | null) => {
    returnFocusRef.current = origin ?? (document.activeElement as HTMLElement | null)
    setSelection(next)
    setOpen(true)
  }, [])

  return (
    <AppShell
      tone="home"
      eyebrow="우리 가족 공간"
      title={family.name}
      flush
      mainClassName="gap-0 pt-0"
      actions={
        <>
          <Button
            variant="ghost"
            size="icon"
            className="relative rounded-full bg-card/70 ring-1 ring-primary/10 hover:bg-card"
            aria-label={unread > 0 ? `마음 수신함, 새로운 마음 ${unread}개` : "마음 수신함"}
            asChild
          >
            <Link href="/inbox">
              <Bell className="size-5" aria-hidden="true" />
              {unread > 0 && (
                <span aria-hidden="true" className="absolute top-2 right-2 size-2 rounded-full bg-deco-coral ring-2 ring-card" />
              )}
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full bg-card/70 ring-1 ring-primary/10 hover:bg-card"
            aria-label="가족 구성원"
            onClick={(e) => select({ type: "family" }, e.currentTarget)}
          >
            <UsersRound className="size-5" aria-hidden="true" />
          </Button>
        </>
      }
    >
      <PixelScene
        family={family}
        theme={family.theme}
        viewerId={viewerId}
        spotOf={spotOf}
        onMove={moveMember}
        onMemberSelect={(id, origin) => select({ type: "member", id }, origin)}
      />
      {family.members.length > 4 && (
        <Button
          variant="ghost"
          className="h-11 w-full rounded-none bg-secondary text-sm font-semibold text-primary hover:bg-secondary"
          onClick={(e) => select({ type: "family" }, e.currentTarget)}
        >
          구성원 {family.members.length}명 전체 보기
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      )}
      <div className="relative z-10 -mt-3 rounded-t-2xl bg-background px-4 pt-5 pb-2 shadow-sheet">
        <HomeSummary onSelect={select} />
      </div>
      <HomeDetailSheet selection={selection} open={open} onOpenChange={setOpen} returnFocusRef={returnFocusRef} />
    </AppShell>
  )
}
