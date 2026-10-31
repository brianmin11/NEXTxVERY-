import type { Metadata } from "next"
import { LiveAccount } from "@/src/features/live/session"
import Link from "next/link"
import { ChevronRight, ClipboardList, Menu } from "lucide-react"

import { Card } from "@/components/ui/card"
import { AppShell } from "@/components/woorijip/app-shell"
import { EmptyState } from "@/components/woorijip/state-views"

export const metadata: Metadata = { title: "더보기" }

/** 더보기: 집안일 진입 항목만 있고 설정 등은 아직 준비 중이다. */
export default function MorePage() {
  return (
    <AppShell title={<h1 className="text-lg font-bold">더보기</h1>}>
      <LiveAccount />
      <Card size="sm" className="py-0">
        <ul>
          <li>
            <Link
              href="/chores"
              className="flex min-h-14 items-center gap-3 rounded-xl px-4 outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-primary">
                <ClipboardList className="size-5" aria-hidden="true" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold">집안일</span>
                <span className="text-sm text-muted-foreground">
                  가족과 나눈 할 일과 완료 기록
                </span>
              </span>
              <ChevronRight
                className="size-5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </Link>
          </li>
        </ul>
      </Card>
      <EmptyState
        icon={Menu}
        title="설정은 아직 준비 중이에요"
        description="가족 설정과 알림 설정은 다음 단계에서 만들어요."
      />
    </AppShell>
  )
}
