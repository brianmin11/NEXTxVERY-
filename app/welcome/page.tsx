import type { Metadata } from "next"

import { WelcomeScreen } from "@/components/onboarding/welcome-screen"

export const metadata: Metadata = { title: "시작하기" }

// 프론트 데모 온보딩. 로그인·실제 가족 생성은 연결되지 않았다.
export default function WelcomePage() {
  return <WelcomeScreen />
}
