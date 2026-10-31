import type { Metadata } from "next"

import { MoreScreen } from "@/components/more/more-screen"

export const metadata: Metadata = { title: "더보기" }

// 프론트 데모: 가족·구성원·테마·초대는 메모리 상태다. 관리자 전용 항목은 권한 함수로 숨긴다.
export default function MorePage() {
  return <MoreScreen />
}
