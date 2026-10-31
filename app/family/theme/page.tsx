import type { Metadata } from "next"

import { ThemeScreen } from "@/components/family/theme-screen"

export const metadata: Metadata = { title: "우리집 테마" }

// 프론트 데모: 관리자만 메모리 상태의 가족 테마를 바꾼다. 실제 저장·동기화는 없다.
export default function FamilyThemePage() {
  return <ThemeScreen />
}
