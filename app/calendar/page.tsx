import type { Metadata } from "next"
import { Suspense } from "react"

import { CalendarRoute } from "@/components/calendar/calendar-route"

export const metadata: Metadata = { title: "가족 일정" }

// 프론트 데모: 메모리 일정만 다루고 실제 DB·외부 캘린더·알림은 없다. ?saved=&date=는 전체 화면 폼에서 돌아올 때 쓴다.
export default function CalendarPage() {
  return (
    <Suspense>
      <CalendarRoute />
    </Suspense>
  )
}
