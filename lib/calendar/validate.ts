import { CALENDAR_LOCATION_MAX, CALENDAR_MEMO_MAX, CALENDAR_TITLE_MAX } from "./config"
import { isValidDateKey, isValidTimeKey, timeToMinutes } from "./date"
import type { CalendarDraft, CalendarDraftErrors, CalendarEvent } from "./types"

/** 폼 검증. 모르는 값을 자동으로 채우지 않고 오류로 돌려준다. */
export function validateDraft(draft: CalendarDraft): CalendarDraftErrors {
  const errors: CalendarDraftErrors = {}
  const title = draft.title.trim()
  if (!title) errors.title = "제목을 입력해 주세요. 공백만으로는 저장할 수 없어요."
  else if (title.length > CALENDAR_TITLE_MAX) errors.title = `제목은 ${CALENDAR_TITLE_MAX}자까지 쓸 수 있어요.`

  if (!draft.date) errors.date = "날짜를 골라 주세요."
  else if (!isValidDateKey(draft.date)) errors.date = "날짜 형식이 올바르지 않아요."

  if (!draft.allDay) {
    if (!draft.startTime) errors.startTime = "시작 시간을 입력해 주세요."
    else if (!isValidTimeKey(draft.startTime)) errors.startTime = "시간은 00:00부터 23:59 사이여야 해요."
    if (!draft.endTime) errors.endTime = "종료 시간을 입력해 주세요."
    else if (!isValidTimeKey(draft.endTime)) errors.endTime = "시간은 00:00부터 23:59 사이여야 해요."
    else if (!errors.startTime && timeToMinutes(draft.endTime) <= timeToMinutes(draft.startTime))
      errors.endTime = "종료 시간은 시작 시간보다 늦어야 해요."
  }

  if (draft.location.length > CALENDAR_LOCATION_MAX) errors.location = `장소는 ${CALENDAR_LOCATION_MAX}자까지 쓸 수 있어요.`
  if (draft.memo.length > CALENDAR_MEMO_MAX) errors.memo = `메모는 ${CALENDAR_MEMO_MAX}자까지 쓸 수 있어요.`
  return errors
}

export function hasErrors(errors: CalendarDraftErrors) {
  return Object.keys(errors).length > 0
}

/** 검증을 통과한 draft를 저장 형태로 바꾼다. 종일이면 시간은 null. */
export function draftToEventFields(draft: CalendarDraft): Omit<CalendarEvent, "id" | "createdByMemberId" | "seed"> {
  return {
    title: draft.title.trim(),
    category: draft.category,
    date: draft.date,
    allDay: draft.allDay,
    startTime: draft.allDay ? null : draft.startTime,
    endTime: draft.allDay ? null : draft.endTime,
    location: draft.location.trim(),
    memo: draft.memo.trim(),
    participantIds: [...draft.participantIds],
  }
}

export function eventToDraft(e: CalendarEvent): CalendarDraft {
  return {
    title: e.title,
    category: e.category,
    date: e.date,
    allDay: e.allDay,
    startTime: e.startTime ?? "",
    endTime: e.endTime ?? "",
    location: e.location,
    memo: e.memo,
    participantIds: [...e.participantIds],
  }
}

export function emptyDraft(date: string, defaultParticipantIds: string[]): CalendarDraft {
  return {
    title: "",
    category: "other",
    date,
    allDay: false,
    startTime: "",
    endTime: "",
    location: "",
    memo: "",
    participantIds: [...defaultParticipantIds],
  }
}

export function draftsEqual(a: CalendarDraft, b: CalendarDraft) {
  return (
    a.title === b.title &&
    a.category === b.category &&
    a.date === b.date &&
    a.allDay === b.allDay &&
    a.startTime === b.startTime &&
    a.endTime === b.endTime &&
    a.location === b.location &&
    a.memo === b.memo &&
    a.participantIds.length === b.participantIds.length &&
    a.participantIds.every((id) => b.participantIds.includes(id))
  )
}
