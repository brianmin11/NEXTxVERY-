import type { Metadata } from "next"

import { HomeScreen } from "@/components/home/home-screen"

export const metadata: Metadata = { title: "우리집" }

// 프론트 데모: 가족·일정·집안일·추억은 루트 provider의 메모리 상태를 읽는다. 실제 데이터 연결은 provider 교체로 한다.
export default function HomePage() {
  return <HomeScreen />
}
