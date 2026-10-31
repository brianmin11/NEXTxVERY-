import { AppBottomNav } from "@/components/woorijip/app-nav"

type AppShellProps = {
  /** 헤더 왼쪽(로고·제목) */
  title: React.ReactNode
  /** 헤더 오른쪽 버튼들 */
  actions?: React.ReactNode
  children: React.ReactNode
}

/**
 * 하단 탭이 있는 앱 화면의 공통 틀.
 * 상단 safe-area, 하단 탭 높이 + safe-area만큼 본문 아래 여백을 둔다.
 */
export function AppShell({ title, actions, children }: AppShellProps) {
  return (
    <div className="min-h-dvh pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+--spacing(6))]">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between gap-2 px-4">
          <div className="flex min-w-0 items-center gap-2">{title}</div>
          {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
        </div>
      </header>
      <main className="mx-auto flex max-w-md flex-col gap-6 px-4 pt-4">{children}</main>
      <AppBottomNav />
    </div>
  )
}

/** 실제 모드에는 가상 데이터 배지를 표시하지 않는다. */
export function DemoBadge() { return null }
