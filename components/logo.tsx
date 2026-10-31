import { cn } from "@/lib/utils"

// The only logo asset. Replace public/logo.svg to rebrand everywhere
// (nav, footer, favicon, OG image).
export const LOGO_SRC = "/logo.svg"
export const BRAND_NAME = "우리집"

type LogoProps = {
  size?: number
  withWordmark?: boolean
  // Override the image source, e.g. a data URI inside next/og ImageResponse.
  src?: string
  className?: string
}

// Layout uses inline styles so the same markup renders in next/og (Satori),
// which ignores class names.
export function Logo({
  size = 24,
  withWordmark = false,
  src = LOGO_SRC,
  className,
}: LogoProps) {
  return (
    <span
      className={cn("text-foreground", className)}
      style={{ display: "flex", alignItems: "center", gap: size / 3 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG, also rendered by next/og */}
      <img
        src={src}
        width={size}
        height={size}
        alt={withWordmark ? "" : BRAND_NAME}
        className="shrink-0"
      />
      {withWordmark && (
        <span
          className="font-sans font-bold tracking-tight"
          style={{ fontSize: size * 0.75, fontWeight: 700 }}
        >
          {BRAND_NAME}
        </span>
      )}
    </span>
  )
}
