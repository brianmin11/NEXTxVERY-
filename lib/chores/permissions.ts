import type { Chore } from "./types"

/**
 * 프론트 데모 권한 규칙. UI와 상태 변경 함수가 같은 함수를 쓴다.
 * 서버 권한 보호가 아니며, 실제 서비스에서는 서버가 다시 검증해야 한다.
 * - 같은 가족의 모든 데모 인물: 조회·추가
 * - 작성자: 수정(미완료일 때)·삭제
 * - 담당자 또는 작성자: 완료·완료 취소
 */
export function canEditChore(chore: Chore, viewerId: string) {
  return chore.createdByMemberId === viewerId && chore.status === "todo"
}

export function canDeleteChore(chore: Chore, viewerId: string) {
  return chore.createdByMemberId === viewerId
}

export function canToggleChore(chore: Chore, viewerId: string) {
  return chore.assigneeMemberId === viewerId || chore.createdByMemberId === viewerId
}
