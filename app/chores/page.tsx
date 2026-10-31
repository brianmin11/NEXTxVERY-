import type { Metadata } from "next"

import { ChoresScreen } from "@/components/chores/chores-screen"

export const metadata: Metadata = { title: "집안일" }

// 프론트 데모: 메모리 상태만 다루고 실제 저장·알림·점수·보상은 없다.
export default function ChoresPage() {
  return <ChoresScreen />
}
