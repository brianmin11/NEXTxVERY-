import Link from "next/link"
import { ChevronRight, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** 섹션 제목 + 오른쪽 '전체' 링크. Figma의 section-title */
export function SectionTitle({
  id,
  title,
  count,
  action,
  className,
}: {
  id?: string
  title: string
  count?: number
  action?: { label: string; href: string }
  className?: string
}) {
  return (
    <div className={cn("flex min-h-11 items-center justify-between gap-2", className)}>
      <h2 id={id} className="text-base font-bold tracking-tight">
        {title}
        {count !== undefined && count > 0 && <span className="ml-1.5 text-sm font-semibold text-muted-foreground tabular-nums">{count}</span>}
      </h2>
      {action && (
        <Button variant="ghost" className="-mr-2 h-11 gap-0.5 px-2 text-sm text-muted-foreground" asChild>
          <Link href={action.href}>
            {action.label}
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      )}
    </div>
  )
}

/** 경계선으로 나뉜 행 목록. 카드 없이 바탕 위에 바로 놓는다. */
export function RowList({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul className={cn("flex flex-col divide-y divide-border border-t border-border", className)} {...props} />
}

type RowBodyProps = {
  leading?: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** 제목 아래 추가 줄(배지·칩) */
  extra?: React.ReactNode
  trailing?: React.ReactNode
  chevron?: boolean
  titleClassName?: string
}

function RowBody({ leading, title, subtitle, extra, trailing, chevron, titleClassName }: RowBodyProps) {
  return (
    <>
      {leading && <span className="flex shrink-0 items-center self-center text-muted-foreground">{leading}</span>}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-0.5">
        <span className={cn("font-semibold", titleClassName)}>{title}</span>
        {subtitle && <span className="text-sm text-muted-foreground">{subtitle}</span>}
        {extra && <span className="flex flex-wrap items-center gap-1.5 pt-1">{extra}</span>}
      </span>
      {trailing}
      {chevron && <ChevronRight className="size-5 shrink-0 self-center text-muted-foreground" aria-hidden="true" />}
    </>
  )
}

type ListRowProps = RowBodyProps & {
  href?: string
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
  className?: string
  "aria-label"?: string
}

const rowClass =
  "flex min-h-15 w-full items-center gap-3 px-1 py-3 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset active:bg-muted"

/** 누르면 이동하거나 열리는 행. href면 링크, onClick이면 버튼, 둘 다 없으면 정적 행. */
export function ListRow({ href, onClick, className, "aria-label": ariaLabel, ...body }: ListRowProps) {
  if (href) {
    return (
      <li className="flex">
        <Link href={href} aria-label={ariaLabel} className={cn(rowClass, className)}>
          <RowBody {...body} />
        </Link>
      </li>
    )
  }
  if (onClick) {
    return (
      <li className="flex">
        <button type="button" aria-label={ariaLabel} onClick={onClick} className={cn(rowClass, className)}>
          <RowBody {...body} />
        </button>
      </li>
    )
  }
  return (
    <li className={cn("flex min-h-15 w-full items-center gap-3 px-1 py-3", className)}>
      <RowBody {...body} />
    </li>
  )
}

/** 더보기 메뉴 묶음: 작은 그룹 라벨 + 아이콘 행들 */
export function MenuGroup({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-label={label} className={cn("flex flex-col gap-1", className)}>
      <p className="px-1 text-xs font-semibold text-muted-foreground">{label}</p>
      <ul className="flex flex-col divide-y divide-border">{children}</ul>
    </section>
  )
}

export function MenuRow({
  icon: Icon,
  title,
  subtitle,
  href,
  onClick,
  trailing,
}: {
  icon: LucideIcon
  title: string
  subtitle?: React.ReactNode
  href?: string
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
  trailing?: React.ReactNode
}) {
  return (
    <ListRow
      href={href}
      onClick={onClick}
      className="min-h-17"
      leading={<Icon className="size-6" aria-hidden="true" />}
      title={title}
      subtitle={subtitle}
      trailing={trailing}
      chevron={!trailing}
    />
  )
}
