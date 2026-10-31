import type { HouseStage } from "@/lib/home.fixture"

/**
 * 집 장면의 순수 SVG 레이어. 좌표계 0 0 400 240, 바닥선 y≈200.
 * 고정 시점(정면 + 오른쪽 옆면), 광원은 왼쪽 위. 상태에 따라 레이어만 더해지고 카메라·집 크기는 그대로다.
 */
export const SCENE_BOX = { width: 400, height: 240 } as const

/**
 * 집 그룹(아래 House/Mailbox/Planter/Flowers/Garden/Garland 레이어)의 장면 배치.
 * 집 좌표계(폭 188, 바닥 y=202)를 0.75배로 줄여 뒤쪽 중앙(바닥 y≈150)에 고정한다.
 * 장면 폭의 약 35%. 모든 단계에서 같은 앵커·비율을 쓴다.
 */
export const HOUSE_PLACEMENT = { scale: 0.75, x: 47, y: -1.5 } as const
export const HOUSE_TRANSFORM = `translate(${HOUSE_PLACEMENT.x} ${HOUSE_PLACEMENT.y}) scale(${HOUSE_PLACEMENT.scale})`

export const HOUSE_STAGE_LABELS: Record<HouseStage, string> = {
  1: "작은 집",
  2: "화분",
  3: "꽃",
  4: "정원",
  5: "가랜드와 무지개",
}

export function SkyLayer({ rainbow }: { rainbow: boolean }) {
  return (
    <g>
      <rect width="400" height="240" fill="var(--scene-sky)" />
      {/* 왼쪽 위 정지 버튼(약 x 12~58, y 12~58)을 피해 놓는다 */}
      <circle cx="80" cy="34" r="15" fill="var(--scene-sun)" opacity="0.9" />
      {rainbow && (
        <g fill="none" strokeWidth="6" strokeLinecap="round" opacity="0.85">
          <path d="M222 98a60 60 0 0 1 120 0" stroke="var(--deco-apricot)" />
          <path d="M229 98a53 53 0 0 1 106 0" stroke="var(--deco-butter)" />
          <path d="M236 98a46 46 0 0 1 92 0" stroke="var(--deco-sky)" />
        </g>
      )}
      <g fill="var(--scene-cloud)" opacity="0.95">
        <Cloud x={126} y={20} scale={0.65} />
        <Cloud x={352} y={26} scale={0.65} />
      </g>
    </g>
  )
}

function Cloud({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="0" rx="26" ry="11" />
      <circle cx="-8" cy="-6" r="11" />
      <circle cx="8" cy="-8" r="13" />
    </g>
  )
}

/** 넓은 마당. 집 뒤(y≈140)부터 장면 아래까지 이어진다. */
export function GroundLayer() {
  return (
    <g>
      <ellipse cx="200" cy="206" rx="268" ry="64" fill="var(--scene-grass)" />
      <path d="M-70 226Q200 262 470 226V240H-70Z" fill="var(--scene-grass-dark)" opacity="0.45" />
      {/* 마당 가장자리 덤불: 깊이감용 */}
      <g fill="var(--scene-leaf)" opacity="0.9">
        <circle cx="18" cy="214" r="10" />
        <circle cx="30" cy="220" r="8" fill="var(--scene-leaf-dark)" />
        <circle cx="382" cy="212" r="10" />
        <circle cx="370" cy="219" r="8" fill="var(--scene-leaf-dark)" />
      </g>
    </g>
  )
}

/** 집 그림자(집 좌표계). 광원 반대쪽(오른쪽 아래)으로 */
export function HouseShadowLayer() {
  return <ellipse cx="214" cy="203" rx="104" ry="11" fill="var(--scene-shadow)" />
}

export function HouseLayer() {
  return (
    <g>
      {/* 옆면 */}
      <path d="M240 110L290 92V182L240 200Z" fill="var(--scene-wall-shade)" />
      {/* 정면 */}
      <rect x="120" y="110" width="120" height="90" fill="var(--scene-wall)" />
      {/* 옆면 창 */}
      <path d="M256 128L276 121V145L256 152Z" fill="var(--scene-window)" />
      <path d="M256 128L276 121V145L256 152Z" fill="none" stroke="var(--scene-wall)" strokeWidth="2" />
      {/* 지붕: 뒤쪽 돌출 → 앞 돔 순서 */}
      <path d="M110 114C110 60 250 60 250 114L298 96C298 42 158 42 158 96Z" fill="var(--scene-roof-shade)" />
      <rect x="214" y="68" width="14" height="24" rx="2" fill="var(--scene-roof-shade)" />
      <rect x="212" y="66" width="18" height="6" rx="2" fill="var(--scene-wall-shade)" />
      <path d="M110 114C110 60 250 60 250 114Z" fill="var(--scene-roof)" />
      <path d="M110 114C110 60 250 60 250 114" fill="none" stroke="var(--scene-roof-shade)" strokeWidth="3" />
      {/* 처마 그림자 */}
      <rect x="120" y="112" width="120" height="6" fill="var(--scene-shadow)" />
      {/* 앞 창 */}
      <rect x="160" y="132" width="40" height="34" rx="9" fill="var(--scene-window)" />
      <g stroke="var(--scene-wall)" strokeWidth="3" strokeLinecap="round">
        <path d="M180 134v30M162 149h36" />
      </g>
      <rect x="160" y="132" width="40" height="34" rx="9" fill="none" stroke="var(--scene-wall-shade)" strokeWidth="2" />
      {/* 문 */}
      <path d="M132 200V168a11 11 0 0 1 22 0v32Z" fill="var(--scene-wood)" />
      <circle cx="150" cy="186" r="1.8" fill="var(--scene-window)" />
      <rect x="128" y="198" width="30" height="4" rx="2" fill="var(--scene-wall-shade)" />
    </g>
  )
}

export function MailboxLayer() {
  return (
    <g>
      <rect x="96" y="170" width="4" height="32" rx="1" fill="var(--scene-wood)" />
      <rect x="86" y="158" width="24" height="15" rx="7" fill="var(--deco-apricot)" stroke="var(--scene-roof-shade)" strokeWidth="1.5" />
      <rect x="86" y="163" width="24" height="3" fill="var(--scene-roof-shade)" opacity="0.5" />
      <path d="M108 160v-8h6v3h-6" fill="var(--scene-roof-shade)" />
    </g>
  )
}

/** 2단계: 문 옆 화분 */
export function PlanterLayer() {
  return (
    <g transform="translate(214 200)">
      <path d="M-10 0l2-14h16l2 14Z" fill="var(--scene-roof-shade)" />
      <rect x="-11" y="-16" width="22" height="4" rx="2" fill="var(--deco-apricot)" />
      <g fill="var(--scene-leaf)">
        <ellipse cx="-5" cy="-24" rx="5" ry="9" transform="rotate(-25 -5 -24)" />
        <ellipse cx="5" cy="-25" rx="5" ry="9" transform="rotate(25 5 -25)" />
        <ellipse cx="0" cy="-29" rx="4" ry="9" fill="var(--scene-leaf-dark)" />
      </g>
    </g>
  )
}

function Flower({ x, y, color, scale = 1 }: { x: number; y: number; color: string; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M0 0v-10" stroke="var(--scene-leaf-dark)" strokeWidth="1.6" strokeLinecap="round" />
      <ellipse cx="3" cy="-5" rx="3" ry="1.6" fill="var(--scene-leaf)" transform="rotate(-30 3 -5)" />
      <g fill={color}>
        <circle cx="0" cy="-15" r="2.6" />
        <circle cx="3.8" cy="-12" r="2.6" />
        <circle cx="2.4" cy="-8" r="2.6" />
        <circle cx="-2.4" cy="-8" r="2.6" />
        <circle cx="-3.8" cy="-12" r="2.6" />
      </g>
      <circle cx="0" cy="-11.5" r="1.8" fill="var(--scene-roof-shade)" />
    </g>
  )
}

/** 3단계: 잔디 꽃 + 창가 화단 */
export function FlowersLayer() {
  return (
    <g>
      <rect x="156" y="166" width="48" height="7" rx="3" fill="var(--scene-wood)" />
      <Flower x={164} y={167} color="var(--deco-apricot)" scale={0.8} />
      <Flower x={176} y={167} color="var(--deco-butter)" scale={0.8} />
      <Flower x={188} y={167} color="var(--scene-cloud)" scale={0.8} />
      <Flower x={198} y={167} color="var(--deco-apricot)" scale={0.8} />
      <Flower x={62} y={208} color="var(--deco-butter)" />
      <Flower x={118} y={214} color="var(--deco-apricot)" scale={0.9} />
      <Flower x={332} y={204} color="var(--scene-cloud)" />
      <Flower x={372} y={214} color="var(--deco-butter)" scale={0.9} />
    </g>
  )
}

/** 4단계: 울타리·덤불·나무 */
export function GardenLayer() {
  const posts = [306, 322, 338, 354, 370]
  return (
    <g>
      {/* 나무(왼쪽, 집 뒤) */}
      <rect x="38" y="150" width="8" height="52" rx="2" fill="var(--scene-wood)" />
      <circle cx="42" cy="132" r="26" fill="var(--scene-leaf)" />
      <circle cx="28" cy="146" r="18" fill="var(--scene-leaf)" />
      <circle cx="56" cy="144" r="18" fill="var(--scene-leaf-dark)" opacity="0.9" />
      {/* 울타리(오른쪽) */}
      <g fill="var(--scene-fence)" stroke="var(--scene-wall-shade)" strokeWidth="1.5">
        {posts.map((x) => (
          <path key={x} d={`M${x - 4} 180V158l4-6 4 6v22Z`} />
        ))}
        <rect x="300" y="162" width="78" height="4" rx="1" />
        <rect x="300" y="172" width="78" height="4" rx="1" />
      </g>
      {/* 덤불 */}
      <g fill="var(--scene-leaf)">
        <circle cx="320" cy="190" r="11" />
        <circle cx="334" cy="193" r="9" fill="var(--scene-leaf-dark)" />
        <circle cx="348" cy="191" r="11" />
      </g>
    </g>
  )
}

/** 5단계: 굴뚝에서 우편함으로 늘어진 가랜드 */
export function GarlandLayer() {
  const p0 = { x: 222, y: 70 }
  const p1 = { x: 160, y: 128 }
  const p2 = { x: 100, y: 156 }
  const colors = ["var(--deco-apricot)", "var(--deco-butter)", "var(--deco-sky)"]
  const flags = [0.12, 0.26, 0.4, 0.54, 0.68, 0.82].map((t, i) => {
    const u = 1 - t
    const x = u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x
    const y = u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y
    return { x, y, color: colors[i % colors.length] }
  })
  return (
    <g>
      <path
        d={`M${p0.x} ${p0.y}Q${p1.x} ${p1.y} ${p2.x} ${p2.y}`}
        fill="none"
        stroke="var(--scene-wood)"
        strokeWidth="1.5"
      />
      {flags.map((f, i) => (
        <path key={i} d={`M${f.x - 5} ${f.y}h10l-5 9Z`} fill={f.color} stroke="rgb(46 52 47 / 0.1)" strokeWidth="0.8" />
      ))}
    </g>
  )
}
