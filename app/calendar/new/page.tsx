import type { Metadata } from "next"

import { EventNewScreen } from "@/components/calendar/event-new-screen"

export const metadata: Metadata = { title: "일정 추가" }

// 프론트 데모: 메모리 일정에만 추가한다. ?date=YYYY-MM-DD로 시작 날짜를 받는다.
export default async function EventNewPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams
  return <EventNewScreen initialDate={typeof date === "string" ? date : undefined} />
}
