import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"

import { BRAND_NAME, LOGO_SRC, Logo } from "@/components/logo"

export const alt = BRAND_NAME
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function Image() {
  const svg = await readFile(join(process.cwd(), "public", LOGO_SRC))
  const src = `data:image/svg+xml;base64,${svg.toString("base64")}`

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fafafa",
          color: "#0a0a0a",
        }}
      >
        <Logo src={src} size={128} withWordmark />
      </div>
    ),
    size
  )
}
