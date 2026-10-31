import type { Metadata, Viewport } from "next"
import { Geist_Mono } from "next/font/google"
import localFont from "next/font/local"

import "./globals.css"
import { CalendarProvider } from "@/components/calendar/calendar-provider"
import { ChoresProvider } from "@/components/chores/chores-provider"
import { DemoViewerProvider } from "@/components/demo/demo-viewer-provider"
import { MemoriesProvider } from "@/components/memories/memories-provider"
import { MindProvider } from "@/components/mind/mind-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { BRAND_NAME, LOGO_SRC } from "@/components/logo"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

// 한글·본문 기본 폰트. 공식 배포 v1.3.9의 가변 woff2 (public/fonts/Pretendard-OFL.txt).
const fontPretendard = localFont({
  src: "../public/fonts/PretendardVariable.woff2",
  weight: "45 920",
  variable: "--font-pretendard",
  display: "swap",
})

// 영문 디스플레이 전용. 한글 글리프가 없어 --font-display 스택에서 Pretendard로 넘어간다.
const fontCal = localFont({
  src: "../public/fonts/CalSansVF.woff2",
  weight: "400 700",
  variable: "--font-cal",
  display: "swap",
  preload: false,
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  preload: false,
})

export const metadata: Metadata = {
  title: { default: BRAND_NAME, template: `%s · ${BRAND_NAME}` },
  description: "가족의 일정과 추억을 함께 담는 우리 가족만의 공간",
  icons: { icon: { url: LOGO_SRC, type: "image/svg+xml" } },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#f7f5ef",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={cn(
        "font-sans antialiased",
        fontPretendard.variable,
        fontCal.variable,
        fontMono.variable
      )}
    >
      <body>
        <ThemeProvider>
          <TooltipProvider>
            {/* 데모 상태(현재 인물·마음·일정): 메모리 전용, 라우트 이동 중 유지, 새로고침 시 초기화 */}
            <DemoViewerProvider>
              <MindProvider>
                <CalendarProvider>
                  <MemoriesProvider>
                    <ChoresProvider>{children}</ChoresProvider>
                  </MemoriesProvider>
                </CalendarProvider>
              </MindProvider>
            </DemoViewerProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
