/** 일정 유형. 내부 값과 표시 이름은 여기서만 정의한다. */
export const CALENDAR_CATEGORIES = ["meal", "dining-out", "trip", "other"] as const
export type CalendarCategory = (typeof CALENDAR_CATEGORIES)[number]

export const CALENDAR_CATEGORY_LABEL: Record<CalendarCategory, string> = {
  meal: "가족 식사",
  "dining-out": "외식",
  trip: "여행",
  other: "기타",
}

/** YYYY-MM-DD */
export type DateKey = string
/** HH:mm (24시간) */
export type TimeKey = string

/**
 * 가족이 공유하는 하루짜리 일정. 여러 날·반복 일정·시간대 변환은 후속 범위다.
 * 종일 일정은 startTime·endTime이 null이고, 일반 일정은 endTime > startTime이어야 한다.
 */
export type CalendarEvent = {
  id: string
  title: string
  category: CalendarCategory
  date: DateKey
  allDay: boolean
  startTime: TimeKey | null
  endTime: TimeKey | null
  location: string
  memo: string
  participantIds: string[]
  createdByMemberId: string
  /** 가상 예시 데이터 표시용 */
  seed?: boolean
}

/** 폼 입력값. 저장 전까지 원래 일정을 바꾸지 않는다. */
export type CalendarDraft = {
  title: string
  category: CalendarCategory
  date: DateKey
  allDay: boolean
  startTime: string
  endTime: string
  location: string
  memo: string
  participantIds: string[]
}

export type CalendarDraftErrors = Partial<Record<"title" | "date" | "startTime" | "endTime" | "location" | "memo", string>>
