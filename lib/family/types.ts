import type { MemberTone } from "@/components/woorijip/member"
import type { CharacterConfig } from "@/lib/character/catalog"
import type { SceneTheme } from "@/lib/scene/themes"

export type FamilyMember = {
  id: string
  name: string
  /** 가족 안에서의 호칭(엄마·아빠 등). 관리자 권한과 무관한 표시 문구다. */
  role?: string
  /** 목록·칩의 이니셜 배경색 */
  tone: MemberTone
  /** 본인만 바꿀 수 있는 캐릭터 외형 */
  avatar: CharacterConfig
}

export type Family = {
  id: string
  name: string
  members: FamilyMember[]
  /** 관리자 1명. 가족을 만든 구성원이 초기 관리자이며 역할(엄마 등)과 별개다. */
  adminMemberId: string
  /** 가족 공통 테마. 관리자만 바꾼다. */
  theme: SceneTheme
  /** 데모 초대코드. 실제 초대 발급·검증은 서버가 맡는다. */
  inviteCode: string
  /** 가상 예시 데이터 표시용 */
  seed?: boolean
}

export function findMember(family: Family, id: string) {
  return family.members.find((m) => m.id === id)
}

export function isFamilyAdmin(family: Family, memberId: string) {
  return family.adminMemberId === memberId
}

/** 화면에 보여 주는 권한 문구. 역할(엄마·아빠)과 섞지 않는다. */
export function memberRoleLabel(family: Family, member: FamilyMember) {
  const base = isFamilyAdmin(family, member.id) ? "가족 관리자" : "가족 구성원"
  return member.role ? `${member.role} · ${base}` : base
}
