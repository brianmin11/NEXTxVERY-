import type { Metadata } from "next"

import { MindScreen } from "@/components/mind/mind-screen"

export const metadata: Metadata = { title: "마음 전하기" }

// 프론트 데모: 입력·전달 문장·확인 흐름만 있고 실제 AI·저장·알림은 없다.
export default function MindPage() {
  return <MindScreen />
}
