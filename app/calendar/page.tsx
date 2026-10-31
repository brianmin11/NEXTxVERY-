import type { Metadata } from "next"
import { CalendarDays } from "lucide-react"

import { ComingSoon } from "@/components/woorijip/coming-soon"

export const metadata: Metadata = { title: "일정" }

export default function CalendarPage() {
  return <ComingSoon title="일정" description="가족 일정을 한눈에 보는 화면을 다음 단계에서 만들어요." icon={CalendarDays} />
}
