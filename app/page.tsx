import Link from "next/link"

import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { BRAND_NAME } from "@/components/logo"
import { Button } from "@/components/ui/button"

// 임시 첫 화면. 가족 홈은 다음 모듈에서 MASTER 기준으로 만든다.
export default function Page() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-4 py-24">
        <h1 className="font-display text-4xl font-bold tracking-tight">{BRAND_NAME}</h1>
        <p className="text-muted-foreground">우리 가족만의 공간을 준비하고 있어요.</p>
        {process.env.NODE_ENV !== "production" && (
          <Button variant="outline" asChild className="self-start">
            <Link href="/design-system">디자인 확인 페이지 (개발용)</Link>
          </Button>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
