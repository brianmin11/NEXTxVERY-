import { LockKeyhole, ShieldCheck, type LucideIcon } from "lucide-react"

import { TopBar } from "@/components/woorijip/app-shell"
import { cn } from "@/lib/utils"

type FlowPageProps = {
  title: React.ReactNode
  eyebrow?: React.ReactNode
  back?: string | (() => void)
  backLabel?: string
  actions?: React.ReactNode
  children: React.ReactNode
  /** 화면 아래 고정 버튼 영역 */
  action?: React.ReactNode
  /** 본문 좌우 여백 제거 */
  flush?: boolean
  mainClassName?: string
}

/**
 * 하단 탭이 없는 전체 화면 흐름(온보딩·작성 폼·마음 전하기).
 * 상단바 + 본문 + 바닥 고정 버튼. 키보드가 열리면 뷰포트가 줄어 버튼이 위로 올라온다.
 * 고정 버튼이 포커스를 가리지 않도록 본문 아래 여백을 넉넉히 둔다.
 */
export function FlowPage({ title, eyebrow, back, backLabel, actions, children, action, flush, mainClassName }: FlowPageProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar title={title} eyebrow={eyebrow} back={back} backLabel={backLabel} actions={actions} />
      <main className={cn("mx-auto flex w-full max-w-md flex-1 flex-col gap-6 pt-2 pb-8", flush ? "px-0" : "px-4", mainClassName)}>
        {children}
      </main>
      {action && (
        <footer className="sticky bottom-0 z-30 bg-[linear-gradient(to_bottom,transparent,var(--background)_18%,var(--background))]">
          <div className="mx-auto grid max-w-md gap-2 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+--spacing(5))]">{action}</div>
        </footer>
      )}
    </div>
  )
}

/** "1 / 2", "초대코드" 같은 작은 초록 단계 라벨 */
export function StepLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-xs font-bold tracking-wide text-primary", className)}>{children}</p>
}

/** 흐름 화면의 큰 제목(두 줄 허용) */
export function FlowHeading({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <h2 id={id} className={cn("text-3xl leading-tight font-bold tracking-tight", className)}>
      {children}
    </h2>
  )
}

export function FlowLead({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-base leading-relaxed text-muted-foreground", className)}>{children}</p>
}

/** 개인정보·권한 안내 상자. 색만으로 뜻을 전하지 않도록 아이콘과 문장을 함께 둔다. */
export function PrivacyNote({
  icon: Icon = LockKeyhole,
  title,
  children,
  tone = "info",
  className,
}: {
  icon?: LucideIcon
  title?: string
  children: React.ReactNode
  tone?: "info" | "error"
  className?: string
}) {
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "flex items-start gap-3 rounded-lg px-4 py-3.5 text-sm leading-relaxed",
        tone === "error" ? "bg-destructive/10 text-destructive" : "bg-secondary text-foreground",
        className
      )}
    >
      <Icon className="mt-0.5 size-4.5 shrink-0" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-0.5">
        {title && <p className="font-semibold">{title}</p>}
        <div className={cn(tone === "info" && "text-muted-foreground")}>{children}</div>
      </div>
    </div>
  )
}

export { ShieldCheck }
