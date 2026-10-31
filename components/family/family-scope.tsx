"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { CalendarProvider } from "@/components/calendar/calendar-provider"
import { ChoresProvider } from "@/components/chores/chores-provider"
import { MemoriesProvider } from "@/components/memories/memories-provider"
import { MindProvider } from "@/components/mind/mind-provider"
import { IS_DEMO } from "@/lib/app-mode"

import { useOptionalFamily } from "./family-context"
import { useSession } from "./live-session"

/** 로그인 없이 볼 수 있는 경로 */
const PUBLIC_PATHS = ["/login"]
/** 로그인했지만 가족이 없을 때 볼 수 있는 경로 */
const ONBOARDING_PATHS = ["/welcome", "/family/new", "/join", "/login"]

function startsWithAny(pathname: string, paths: string[]) {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

function FeatureProviders({ familyId, seeded, children }: { familyId: string; seeded: boolean; children: React.ReactNode }) {
  return (
    <MindProvider key={familyId} seeded={seeded}>
      <CalendarProvider seeded={seeded}>
        <MemoriesProvider seeded={seeded}>
          <ChoresProvider seeded={seeded}>{children}</ChoresProvider>
        </MemoriesProvider>
      </CalendarProvider>
    </MindProvider>
  )
}

function Gate({ title }: { title: string }) {
  return (
    <main role="status" aria-live="polite" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
      <Loader2 className="size-6 motion-safe:animate-spin" aria-hidden="true" />
      <p>{title}</p>
    </main>
  )
}

/**
 * 가족 단위 데이터(마음·일정·사진·집안일)를 현재 가족 id로 묶는다.
 * - 데모: 세션이 항상 있으므로 바로 provider를 둔다. seed는 데모 기본 가족에만 넣는다.
 * - 라이브: 세션 상태에 따라 로그인(/login)·온보딩(/welcome 등)으로 보내고, 가족이 있을 때만 provider를 둔다.
 *   가족이 바뀌면 key가 바뀌어 이전 가족 데이터가 화면에 남지 않는다.
 */
export function FamilyScope({ children }: { children: React.ReactNode }) {
  const family = useOptionalFamily()
  const session = useSession()
  const pathname = usePathname()
  const router = useRouter()
  // 개발용 디자인 확인 페이지는 세션 없이도 열린다(프로덕션 404).
  const isDesignSystem = pathname.startsWith("/design-system")

  const status = session?.status ?? "ready"
  const redirectTo =
    IS_DEMO || isDesignSystem
      ? null
      : status === "unauthenticated" && !startsWithAny(pathname, PUBLIC_PATHS)
        ? "/login"
        : status === "no-family" && (!startsWithAny(pathname, ONBOARDING_PATHS) || pathname === "/login")
          ? "/welcome"
          : status === "ready" && pathname === "/login"
            ? "/home"
            : null

  React.useEffect(() => {
    if (redirectTo) router.replace(redirectTo)
  }, [redirectTo, router])

  if (IS_DEMO) {
    if (!family) return <>{children}</>
    return (
      <FeatureProviders familyId={family.family.id} seeded={family.family.seed === true}>
        {children}
      </FeatureProviders>
    )
  }

  if (isDesignSystem) return <>{children}</>
  if (status === "loading") return <Gate title="로그인 상태를 확인하는 중이에요" />
  if (redirectTo) return <Gate title="이동하는 중이에요" />
  if (status === "ready" && family) {
    return (
      <FeatureProviders familyId={family.family.id} seeded={false}>
        {children}
      </FeatureProviders>
    )
  }
  // unauthenticated(/login) 또는 no-family(온보딩 경로): 가족 provider 없이 그린다.
  return <>{children}</>
}
