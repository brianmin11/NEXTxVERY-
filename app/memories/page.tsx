import type { Metadata } from "next"

import { MemoriesScreen } from "@/components/memories/memories-screen"

export const metadata: Metadata = { title: "가족 추억" }

// 프론트 데모: 사진은 브라우저 탭 안 메모리에만 있고 실제 업로드·공유는 없다.
export default function MemoriesPage() {
  return <MemoriesScreen />
}
