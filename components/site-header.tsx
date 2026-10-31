import Link from "next/link"

import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-background/80 backdrop-blur dark:border-neutral-800">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2 px-2">
          <Link href="/" aria-label="홈으로">
            <Logo withWordmark />
          </Link>
        </Button>
      </div>
    </header>
  )
}
