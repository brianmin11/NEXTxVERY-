import type { Metadata } from "next"
import { Images } from "lucide-react"

import { ComingSoon } from "@/components/woorijip/coming-soon"

export const metadata: Metadata = { title: "추억" }

export default function MemoriesPage() {
  return <ComingSoon title="추억" description="사진과 추억을 모아 보는 화면을 다음 단계에서 만들어요." icon={Images} />
}
