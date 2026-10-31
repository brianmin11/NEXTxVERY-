import type { Family } from "./types"
import { isFamilyAdmin } from "./types"

/**
 * 가족 단위 프론트 데모 권한 규칙. UI와 provider 변경 함수가 같은 함수를 쓴다.
 * 서버 권한 보호가 아니며, 실제 서비스에서는 서버가 다시 검증해야 한다.
 * - 관리자: 가족 이름·초대·공통 테마 변경
 * - 모든 구성원: 자기 캐릭터·이름만 편집
 */
export function canChangeTheme(family: Family, viewerId: string) {
  return isFamilyAdmin(family, viewerId)
}

export function canInvite(family: Family, viewerId: string) {
  return isFamilyAdmin(family, viewerId)
}

export function canRenameFamily(family: Family, viewerId: string) {
  return isFamilyAdmin(family, viewerId)
}

export function canEditMember(family: Family, viewerId: string, memberId: string) {
  return viewerId === memberId && family.members.some((m) => m.id === memberId)
}
