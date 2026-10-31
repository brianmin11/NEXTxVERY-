import type { MemberTone } from "@/components/woorijip/member"
import type { AvatarConfig } from "@/lib/home.fixture"

/**
 * 임시 기본형 렌더러: 둥근 몸통 + 얼굴 + 장식 하나.
 * 사람/동물 스타일이 확정되면 같은 props를 받는 다른 렌더러로 교체한다.
 * 좌표계는 0 0 64 72, 바닥 중앙이 (32, 70).
 */
export const BASIC_ROUND_BOX = { width: 64, height: 72 } as const

const toneFill: Record<MemberTone, string> = {
  apricot: "var(--deco-apricot)",
  sky: "var(--deco-sky)",
  butter: "var(--deco-butter)",
  sage: "var(--scene-grass)",
}

export type AvatarGlyphProps = {
  tone: MemberTone
  config: AvatarConfig
}

/** SVG 안에 넣는 <g>. 부모가 translate/scale과 접근성 처리를 맡는다. */
export function BasicRoundAvatar({ tone, config }: AvatarGlyphProps) {
  return (
    <g>
      <ellipse cx="32" cy="69" rx="18" ry="3.5" fill="var(--scene-shadow)" />
      <path
        d="M32 6C15 6 9 24 9 44C9 61 19 70 32 70C45 70 55 61 55 44C55 24 49 6 32 6Z"
        fill={toneFill[tone]}
        stroke="rgb(46 52 47 / 0.14)"
        strokeWidth="1.5"
      />
      {/* 배 쪽 하이라이트: 광원이 왼쪽 위라 살짝 왼쪽으로 */}
      <ellipse cx="29" cy="52" rx="12" ry="10" fill="#fff" opacity="0.35" />
      <Face face={config.face} />
      <Accessory accessory={config.accessory} />
    </g>
  )
}

function Face({ face }: { face: AvatarConfig["face"] }) {
  return (
    <g fill="var(--foreground)" stroke="var(--foreground)" strokeWidth="2" strokeLinecap="round">
      <circle cx="24" cy="31" r="2.4" stroke="none" />
      {face === "wink" ? (
        <path d="M37 31q3-3 6 0" fill="none" />
      ) : (
        <circle cx="40" cy="31" r="2.4" stroke="none" />
      )}
      {face === "calm" ? <path d="M28 41h8" fill="none" /> : <path d="M27 40q5 5 10 0" fill="none" />}
      <g fill="var(--deco-apricot)" stroke="none" opacity="0.7">
        <circle cx="19" cy="38" r="2.6" />
        <circle cx="45" cy="38" r="2.6" />
      </g>
    </g>
  )
}

function Accessory({ accessory }: { accessory: AvatarConfig["accessory"] }) {
  switch (accessory) {
    case "glasses":
      return (
        <g fill="none" stroke="var(--foreground)" strokeWidth="1.6">
          <circle cx="24" cy="31" r="6" />
          <circle cx="40" cy="31" r="6" />
          <path d="M30 31h4" />
        </g>
      )
    case "ribbon":
      return (
        <g fill="var(--deco-apricot)" stroke="rgb(46 52 47 / 0.12)">
          <path d="M14 14l9 5-9 5z" />
          <path d="M32 14l-9 5 9 5z" />
          <circle cx="23" cy="19" r="2.2" fill="var(--scene-roof-shade)" stroke="none" />
        </g>
      )
    case "cap":
      return (
        <g fill="var(--primary)">
          <path d="M14 20C14 10 50 10 50 20L50 22L14 22Z" />
          <rect x="30" y="18" width="26" height="5" rx="2.5" />
        </g>
      )
    case "flower":
      return (
        <g transform="translate(46 12)">
          <g fill="var(--deco-butter)" stroke="rgb(46 52 47 / 0.1)">
            <circle cx="0" cy="-5" r="3" />
            <circle cx="4.8" cy="-1.5" r="3" />
            <circle cx="3" cy="4" r="3" />
            <circle cx="-3" cy="4" r="3" />
            <circle cx="-4.8" cy="-1.5" r="3" />
          </g>
          <circle r="2.2" fill="var(--scene-roof-shade)" />
        </g>
      )
    default:
      return null
  }
}
