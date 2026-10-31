import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AppBottomNav } from "@/components/woorijip/app-nav"
import { cn } from "@/lib/utils"

type TopBarProps = {
  /** 화면 제목. 문자열이면 h1로 감싸고, 노드면 그대로 둔다. */
  title: React.ReactNode
  /** 제목 위 작은 초록 라벨(예: "우리 가족 공간") */
  eyebrow?: React.ReactNode
  /** 뒤로 가기. href면 링크, 함수면 버튼 */
  back?: string | (() => void)
  backLabel?: string
  /** 오른쪽 아이콘 버튼들 */
  actions?: React.ReactNode
  className?: string
  /** 홈 전용 그라데이션 헤더 */
  tone?: "default" | "home"
}

/**
 * Figma 기준 상단바: 76px, 왼쪽 뒤로 + 작은 라벨 + 큰 제목, 오른쪽 44px 아이콘 버튼.
 * 경계선 없이 바탕색을 이어 받아 화면이 한 장처럼 보이게 한다.
 */
export function TopBar({ title, eyebrow, back, backLabel = "뒤로", actions, className, tone = "default" }: TopBarProps) {
  const heading =
    typeof title === "string" ? (
      <h1 className="truncate text-xl leading-tight font-bold tracking-tight">{title}</h1>
    ) : (
      title
    )
  return (
    <header
      className={cn(
        "sticky top-0 z-30 pt-[env(safe-area-inset-top)]",
        tone === "home"
          ? "bg-[linear-gradient(135deg,var(--home-header-from),var(--home-header-to))]"
          : "bg-background/95 backdrop-blur-sm",
        className
      )}
    >
      <div className="mx-auto flex min-h-19 max-w-md items-center justify-between gap-2 px-4 py-3">
        <div className="flex min-w-0 items-center gap-1">
          {typeof back === "string" ? (
            <Button variant="ghost" size="icon" className="-ml-2 rounded-full" asChild>
              <Link href={back} aria-label={backLabel}>
                <ArrowLeft className="size-5" aria-hidden="true" />
              </Link>
            </Button>
          ) : back ? (
            <Button variant="ghost" size="icon" className="-ml-2 rounded-full" aria-label={backLabel} onClick={back}>
              <ArrowLeft className="size-5" aria-hidden="true" />
            </Button>
          ) : null}
          <div className="flex min-w-0 flex-col">
            {eyebrow && <span className="text-xs font-bold tracking-wide text-primary">{eyebrow}</span>}
            {heading}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </div>
    </header>
  )
}

type AppShellProps = Omit<TopBarProps, "className"> & {
  children: React.ReactNode
  /** 본문 좌우 여백 제거(전체 폭 목록·격자) */
  flush?: boolean
  /** 하단 탭 숨김(상세·작성 화면) */
  hideNav?: boolean
  mainClassName?: string
}

/**
 * 하단 탭이 있는 앱 화면의 공통 틀.
 * 상단 safe-area, 하단 탭 높이 + safe-area만큼 본문 아래 여백을 둔다.
 */
export function AppShell({ children, flush = false, hideNav = false, mainClassName, ...bar }: AppShellProps) {
  return (
    <div
      className={cn(
        "min-h-dvh",
        hideNav ? "pb-[calc(env(safe-area-inset-bottom)+--spacing(6))]" : "pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+--spacing(6))]"
      )}
    >
      <TopBar {...bar} />
      <main className={cn("mx-auto flex max-w-md flex-col gap-6", flush ? "px-0" : "px-4", "pt-2", mainClassName)}>{children}</main>
      {!hideNav && <AppBottomNav />}
    </div>
  )
}

/** 화면 상단의 작은 데모 표시 */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn("h-6 self-start px-2.5 text-muted-foreground", className)}>
      프론트 데모 · 가상 데이터
    </Badge>
  )
}
