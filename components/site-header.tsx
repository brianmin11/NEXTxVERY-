import Link from "next/link"

import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
        <Button variant="ghost" asChild className="-ml-2 px-2">
          <Link href="/" aria-label="홈으로">
            <Logo withWordmark />
          </Link>
        </Button>
      </div>
    </header>
  )
}
