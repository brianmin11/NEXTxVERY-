"use client"

import { useCalendar } from "./calendar-provider"
import { CalendarScreen } from "./calendar-screen"

/**
 * 오늘 날짜가 바뀌면(자정, 또는 개발용 ?today= 고정) 화면을 다시 마운트해
 * 초기 월·선택 날짜가 새 오늘을 따르게 한다.
 */
export function CalendarRoute() {
  const { today } = useCalendar()
  return <CalendarScreen key={today} />
}
