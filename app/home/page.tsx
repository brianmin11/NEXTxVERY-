import type { Metadata } from "next"

import { HomeScreen } from "@/components/home/home-screen"

export const metadata: Metadata = { title: "우리집" }

// 로그인한 가족의 세션과 서버 provider를 사용한다.
export default function HomePage() {
  return <HomeScreen />
}
