import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

export default function Page() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-24">
        <h1 className="font-display text-5xl font-semibold tracking-tight">
          NEXT×VERY
        </h1>
        <p className="mt-4 max-w-prose text-muted-foreground">
          Design system ready.
        </p>
      </main>
      <SiteFooter />
    </div>
  )
}
