"use client"

import * as React from "react"
import { Bell, Users } from "lucide-react"

import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { AppShell, DemoBadge } from "@/components/woorijip/app-shell"
import type { HomeData } from "@/lib/home.fixture"

import { FamilyHouseScene } from "./family-house-scene"
import { HomeDetailSheet } from "./home-detail-sheet"
import type { HomeSelection } from "./home-selection"
import { HomeSummary } from "./home-summary"

type HomeScreenProps = {
  data: HomeData
}

/** 가족 홈 조립. 시트는 selectedItem 하나로만 열려 겹치지 않는다. */
export function HomeScreen({ data }: HomeScreenProps) {
  const [selection, setSelection] = React.useState<HomeSelection | null>(null)
  const [open, setOpen] = React.useState(false)
  // 시트를 연 요소. 트리거 없이 여는 모달은 Radix가 포커스를 돌려주지 않아 직접 기억한다.
  const returnFocusRef = React.useRef<HTMLElement | null>(null)

  const select = React.useCallback((next: HomeSelection, origin?: HTMLElement | null) => {
    returnFocusRef.current = origin ?? (document.activeElement as HTMLElement | null)
    setSelection(next)
    setOpen(true)
  }, [])

  const unread = data.notifications.length

  return (
    <AppShell
      title={
        <>
          <Logo size={24} />
          <h1 className="truncate text-lg font-bold">{data.family.name}</h1>
        </>
      }
      actions={
        <>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={unread > 0 ? `알림 ${unread}개` : "알림"}
            onClick={(e) => select({ type: "notifications" }, e.currentTarget)}
          >
            <Bell className="size-5" aria-hidden="true" />
            {unread > 0 && (
              <span aria-hidden="true" className="absolute top-2.5 right-2.5 size-2 rounded-full bg-primary ring-2 ring-background" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="가족 보기"
            onClick={(e) => select({ type: "family" }, e.currentTarget)}
          >
            <Users className="size-5" aria-hidden="true" />
          </Button>
        </>
      }
    >
      <DemoBadge />
      <FamilyHouseScene
        family={data.family}
        stage={data.family.houseStage}
        onMemberSelect={(id, origin) => select({ type: "member", id }, origin)}
        onMoreSelect={(origin) => select({ type: "family" }, origin)}
        motionPaused={open}
      />
      <HomeSummary data={data} onSelect={select} />
      <HomeDetailSheet
        data={data}
        selection={selection}
        open={open}
        onOpenChange={setOpen}
        returnFocusRef={returnFocusRef}
      />
    </AppShell>
  )
}
