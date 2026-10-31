import Link from "next/link"
import type { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { AppShell, DemoBadge } from "@/components/woorijip/app-shell"
import { EmptyState } from "@/components/woorijip/state-views"

type ComingSoonProps = {
  title: string
  description: string
  icon: LucideIcon
}

/** 아직 만들지 않은 탭의 임시 화면. 홈으로 돌아가는 길만 제공한다. */
export function ComingSoon({ title, description, icon }: ComingSoonProps) {
  return (
    <AppShell title={<h1 className="text-lg font-bold">{title}</h1>}>
      <DemoBadge />
      <EmptyState
        icon={icon}
        title="아직 준비 중이에요"
        description={description}
        action={
          <Button asChild>
            <Link href="/home">우리집으로 돌아가기</Link>
          </Button>
        }
      />
    </AppShell>
  )
}
