import Link from "next/link"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type BottomNavItem = {
  key: string
  label: string
  href: string
  icon: LucideIcon
}

type BottomNavProps = {
  items: BottomNavItem[]
  activeKey?: string
  className?: string
}

/**
 * 모바일 하단 4탭. 활성 탭은 색 + 굵기 + 상단 표시줄로 구분하고 aria-current로 알린다.
 * 하단 safe-area만큼 안쪽 여백을 더한다.
 */
export function BottomNav({ items, activeKey, className }: BottomNavProps) {
  return (
    <nav
      aria-label="주요 메뉴"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm",
        className
      )}
    >
      <ul className="mx-auto grid h-(--bottom-nav-height) max-w-md grid-cols-4">
        {items.map(({ key, label, href, icon: Icon }) => {
          const active = key === activeKey
          return (
            <li key={key} className="flex">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset active:bg-muted",
                  active && "font-semibold text-primary hover:text-primary"
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-0 h-0.5 w-8 rounded-full bg-primary opacity-0 transition-opacity",
                    active && "opacity-100"
                  )}
                />
                <Icon className="size-6" strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
