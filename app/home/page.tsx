import type { Metadata } from "next"

import { HomeScreen } from "@/components/home/home-screen"
import { DEMO_HOME } from "@/lib/home.fixture"

export const metadata: Metadata = { title: "우리집" }

// 프론트 데모: 가상 데이터만 쓴다. 실제 데이터 연결은 이후 단계에서 한다.
export default function HomePage() {
  return <HomeScreen data={DEMO_HOME} />
}
