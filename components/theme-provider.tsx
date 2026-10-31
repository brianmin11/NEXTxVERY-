"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

// 다크 토큰을 우리집 기준으로 검증하기 전까지 라이트 테마로 고정한다.
// 단축키 테마 전환은 시연 중 오작동을 막기 위해 제거했다.
function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      forcedTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}

export { ThemeProvider }
