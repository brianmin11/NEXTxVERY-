import { FAMILY_NAME_MAX_LENGTH, MEMBER_NAME_MAX_LENGTH } from "./config"

function length(text: string) {
  return Array.from(text).length
}

/** 공백만 있는 이름을 막고 길이를 제한한다. 모르는 값을 채워 넣지 않는다. */
export function validateFamilyName(name: string): string | null {
  const trimmed = name.trim()
  if (trimmed === "") return "가족 이름을 입력해 주세요"
  if (length(trimmed) > FAMILY_NAME_MAX_LENGTH) return `가족 이름은 ${FAMILY_NAME_MAX_LENGTH}자까지 쓸 수 있어요`
  return null
}

export function validateMemberName(name: string): string | null {
  const trimmed = name.trim()
  if (trimmed === "") return "이름을 입력해 주세요"
  if (length(trimmed) > MEMBER_NAME_MAX_LENGTH) return `이름은 ${MEMBER_NAME_MAX_LENGTH}자까지 쓸 수 있어요`
  return null
}

/** 초대코드 입력 정리: 대문자화·공백 제거. 유효성은 조회 결과로만 판단한다. */
export function normalizeInviteCode(code: string) {
  return code.replace(/\s+/g, "").toUpperCase()
}
