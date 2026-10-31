import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"

import { BRAND_NAME, LOGO_SRC, Logo } from "@/components/logo"

export const alt = BRAND_NAME
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// OG 렌더러(Satori)는 woff2와 가변 폰트를 읽지 못해 Pretendard 공식 정적 Bold 서브셋(woff)을 쓴다.
export default async function Image() {
  const publicDir = join(process.cwd(), "public")
  const [svg, pretendardBold] = await Promise.all([
    readFile(join(publicDir, LOGO_SRC)),
    readFile(join(publicDir, "fonts", "Pretendard-Bold.subset.woff")),
  ])
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
          background: "#f7f5ef",
          color: "#2e342f",
          fontFamily: "Pretendard",
        }}
      >
        <Logo src={src} size={128} withWordmark />
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Pretendard", data: pretendardBold, weight: 700, style: "normal" },
      ],
    }
  )
}
