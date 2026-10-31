import type { DateKey } from "@/lib/calendar/types"

/** 저장하는 상태는 둘뿐. '기한 지남'은 날짜와 오늘로 계산하는 표시다. */
export type ChoreStatus = "todo" | "done"

export type Chore = {
  revision?: number
  id: string
  title: string
  memo: string
  assigneeMemberId: string
  /** YYYY-MM-DD 또는 null(날짜 미정). 시간은 붙이지 않는다 */
  dueDate: DateKey | null
  status: ChoreStatus
  createdByMemberId: string
  /** ISO 8601 */
  createdAt: string
  updatedAt: string
  completedAt: string | null
  completedByMemberId: string | null
  /** 가상 예시 데이터 표시용 */
  seed?: boolean
}

/** 폼 입력값 */
export type ChoreDraft = {
  title: string
  memo: string
  assigneeMemberId: string
  /** "" = 날짜 미정 */
  dueDate: string
}

export type ChoreDraftErrors = Partial<Record<keyof ChoreDraft, string>>

/** 추가 화면 초안(작성한 인물에게만 보임) */
export type ChoreNewDraft = ChoreDraft & {
  ownerId: string | null
  step: "compose" | "done"
  submitToken: string | null
  createdId: string | null
}
