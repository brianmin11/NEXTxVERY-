import { BRAND_NAME, Logo } from "@/components/logo"

export function SiteFooter() {
  return (
    <footer className="border-t border-border pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex h-16 max-w-md items-center justify-between px-4 text-sm text-muted-foreground">
        <Logo size={20} />
        <p>
          © {new Date().getFullYear()} {BRAND_NAME}
        </p>
      </div>
    </footer>
  )
}
