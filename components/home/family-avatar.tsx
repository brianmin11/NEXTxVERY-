import { cn } from "@/lib/utils"
import type { FamilyMember } from "@/lib/home.fixture"

import { BASIC_ROUND_BOX, BasicRoundAvatar, type AvatarGlyphProps } from "./avatar-renderers/basic-round"

// 렌더러 교체 지점. 스타일이 확정되면 이 두 줄만 바꾼다.
const AvatarGlyph = BasicRoundAvatar
export const AVATAR_BOX = BASIC_ROUND_BOX

type FamilyAvatarProps = {
  member: Pick<FamilyMember, "name" | "tone" | "avatar">
  /** 픽셀 높이 */
  size?: number
  className?: string
  /** 장식용이면 true. 기본은 이름을 읽어 준다. */
  decorative?: boolean
}

/** 목록·시트·프로필에서 쓰는 독립 SVG 캐릭터 */
export function FamilyAvatar({ member, size = 48, className, decorative = false }: FamilyAvatarProps) {
  const width = (size * AVATAR_BOX.width) / AVATAR_BOX.height
  return (
    <svg
      viewBox={`0 0 ${AVATAR_BOX.width} ${AVATAR_BOX.height}`}
      width={width}
      height={size}
      className={cn("shrink-0", className)}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : `${member.name} 캐릭터`}
      aria-hidden={decorative || undefined}
    >
      <AvatarGlyph tone={member.tone} config={member.avatar} />
    </svg>
  )
}

/** 장면 SVG 안에 배치하는 캐릭터. (x, y)는 바닥 중앙. */
export function SceneAvatar({ x, y, scale = 1, ...glyph }: AvatarGlyphProps & { x: number; y: number; scale?: number }) {
  const tx = x - (AVATAR_BOX.width * scale) / 2
  const ty = y - AVATAR_BOX.height * scale
  return (
    <g transform={`translate(${tx} ${ty}) scale(${scale})`}>
      <AvatarGlyph {...glyph} />
    </g>
  )
}
