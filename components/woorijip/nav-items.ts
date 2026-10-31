import { CalendarDays, House, Images, Menu } from "lucide-react"

import type { BottomNavItem } from "@/components/woorijip/bottom-nav"

/** 앱 공통 하단 4탭. 경로를 바꾸면 여기만 고친다. 서버·클라이언트 어디서든 import할 수 있게 "use client" 없이 둔다. */
export const APP_NAV_ITEMS: BottomNavItem[] = [
  { key: "home", label: "우리집", href: "/home", icon: House },
  { key: "calendar", label: "일정", href: "/calendar", icon: CalendarDays },
  { key: "memories", label: "추억", href: "/memories", icon: Images },
  { key: "more", label: "더보기", href: "/more", icon: Menu },
]

/** 탭에 없는 경로(/mind, /inbox 등)에서는 어떤 탭도 활성으로 표시하지 않는다. */
export function activeNavKey(pathname: string) {
  return APP_NAV_ITEMS.find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))?.key
}
