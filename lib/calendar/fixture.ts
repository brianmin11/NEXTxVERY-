import { addDays, parseDateKey, toDateKey } from "./date"
import type { CalendarEvent, DateKey } from "./types"

/**
 * 가상 일정 seed. 홈 '오늘 일정'과 캘린더가 같은 원본을 읽는다.
 * 오늘 날짜를 기준으로 상대적으로 만들어 데모가 날짜에 묶이지 않게 한다. 한 번만 만든다.
 */
export function seedEvents(today: DateKey, memberIds: string[]): CalendarEvent[] {
  const [first, second, third, fourth] = memberIds
  const all = [...memberIds]
  const p = parseDateKey(today)
  const yearEnd = p ? toDateKey(p.year, 12, 31) : addDays(today, 60)
  return [
    {
      id: "seed-dinner",
      title: "함께 저녁 먹기",
      category: "meal",
      date: today,
      allDay: false,
      startTime: "19:00",
      endTime: "20:30",
      location: "우리집 거실",
      memo: "할머니 생신 전에 미리 모여서 메뉴를 정해요. 늦으면 가족방에 먼저 알려 주세요.",
      participantIds: all,
      createdByMemberId: first,
      seed: true,
    },
    {
      id: "seed-walk",
      title: "저녁 산책",
      category: "other",
      date: today,
      allDay: false,
      startTime: "20:30",
      endTime: "21:30",
      location: "동네 공원",
      memo: "",
      participantIds: [first, second].filter(Boolean),
      createdByMemberId: second ?? first,
      seed: true,
    },
    {
      id: "seed-dining-out",
      title: "주말 외식",
      category: "dining-out",
      date: addDays(today, 2),
      allDay: false,
      startTime: "12:00",
      endTime: "13:30",
      location: "동네 파스타집",
      memo: "",
      participantIds: all,
      createdByMemberId: third ?? first,
      seed: true,
    },
    {
      id: "seed-birthday",
      title: "할머니 생신",
      category: "other",
      date: addDays(today, 15),
      allDay: true,
      startTime: null,
      endTime: null,
      location: "",
      memo: "선물은 가족방에서 정해요.",
      participantIds: all,
      createdByMemberId: first,
      seed: true,
    },
    {
      id: "seed-trip",
      title: "연말 가족 모임",
      category: "trip",
      date: yearEnd,
      allDay: true,
      startTime: null,
      endTime: null,
      location: "외갓집",
      memo: "",
      participantIds: all,
      createdByMemberId: fourth ?? first,
      seed: true,
    },
  ]
}
