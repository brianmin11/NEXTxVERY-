import type { Metadata } from "next"
import { Menu } from "lucide-react"

import { ComingSoon } from "@/components/woorijip/coming-soon"

export const metadata: Metadata = { title: "더보기" }

export default function MorePage() {
  return <ComingSoon title="더보기" description="가사분담, 마음 전하기, 설정은 다음 단계에서 만들어요." icon={Menu} />
}
