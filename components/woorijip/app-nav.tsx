"use client"

import { usePathname } from "next/navigation"

import { BottomNav } from "@/components/woorijip/bottom-nav"
import { APP_NAV_ITEMS, activeNavKey } from "@/components/woorijip/nav-items"

/** 현재 pathname에 맞춰 활성 탭을 표시한다. */
export function AppBottomNav() {
  const pathname = usePathname()
  return <BottomNav items={APP_NAV_ITEMS} activeKey={activeNavKey(pathname)} />
}
