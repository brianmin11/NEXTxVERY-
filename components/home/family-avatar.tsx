import { PixelCharacter } from "@/components/character/pixel-character"
import type { FamilyMember } from "@/lib/family/types"

type FamilyAvatarProps = {
  member: Pick<FamilyMember, "name" | "avatar">
  /** 픽셀 높이 */
  size?: number
  className?: string
  /** 장식용이면 true. 기본은 이름을 읽어 준다. */
  decorative?: boolean
}

/** 목록·시트·프로필에서 쓰는 구성원 캐릭터. 렌더러는 PixelCharacter 하나다. */
export function FamilyAvatar({ member, size = 48, className, decorative = false }: FamilyAvatarProps) {
  return <PixelCharacter config={member.avatar} name={member.name} size={size} decorative={decorative} className={className} />
}
