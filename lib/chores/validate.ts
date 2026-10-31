import { isValidDateKey } from "@/lib/calendar/date"

import { CHORE_MEMO_MAX, CHORE_TITLE_MAX } from "./config"
import type { Chore, ChoreDraft, ChoreDraftErrors } from "./types"

export function validateChoreDraft(draft: ChoreDraft, memberIds: string[]): ChoreDraftErrors {
  const errors: ChoreDraftErrors = {}
  const title = draft.title.trim()
  if (!title) errors.title = "할 일 이름을 입력해 주세요. 공백만으로는 저장할 수 없어요."
  else if (title.length > CHORE_TITLE_MAX) errors.title = `이름은 ${CHORE_TITLE_MAX}자까지 쓸 수 있어요.`
  if (draft.memo.length > CHORE_MEMO_MAX) errors.memo = `메모는 ${CHORE_MEMO_MAX}자까지 쓸 수 있어요.`
  if (!draft.assigneeMemberId || !memberIds.includes(draft.assigneeMemberId)) errors.assigneeMemberId = "담당할 가족을 한 명 골라 주세요."
  if (draft.dueDate && !isValidDateKey(draft.dueDate)) errors.dueDate = "날짜 형식이 올바르지 않아요."
  return errors
}

export function hasChoreErrors(errors: ChoreDraftErrors) {
  return Object.keys(errors).length > 0
}

/** 검증을 통과한 draft를 저장 필드로. 빈 날짜는 null(날짜 미정). */
export function draftToChoreFields(draft: ChoreDraft): Pick<Chore, "title" | "memo" | "assigneeMemberId" | "dueDate"> {
  return {
    title: draft.title.trim(),
    memo: draft.memo.trim(),
    assigneeMemberId: draft.assigneeMemberId,
    dueDate: draft.dueDate || null,
  }
}

export function choreToDraft(c: Chore): ChoreDraft {
  return { title: c.title, memo: c.memo, assigneeMemberId: c.assigneeMemberId, dueDate: c.dueDate ?? "" }
}

export function choreDraftsEqual(a: ChoreDraft, b: ChoreDraft) {
  return a.title === b.title && a.memo === b.memo && a.assigneeMemberId === b.assigneeMemberId && a.dueDate === b.dueDate
}
