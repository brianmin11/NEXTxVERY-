import { Button } from "@/components/ui/button"
import type { Family, HouseStage } from "@/lib/home.fixture"

import { SceneAvatar } from "./family-avatar"
import {
  FlowersLayer,
  GardenLayer,
  GarlandLayer,
  GroundLayer,
  HouseLayer,
  MailboxLayer,
  PlanterLayer,
  SCENE_BOX,
  SkyLayer,
} from "./house-layers"

type FamilyHouseSceneProps = {
  family: Family
  /** 시각 상태 ID. 산정 정책은 미정이며 장면은 이 값만 본다. */
  stage: HouseStage
  /** 집 앞에 보여줄 최대 인원(UI 설정). 가족 인원 자체를 제한하지 않는다. */
  maxVisible?: number
  /** origin은 시트를 닫은 뒤 포커스를 돌려줄 요소 */
  onMemberSelect: (memberId: string, origin: HTMLElement) => void
  onMoreSelect: (origin: HTMLElement) => void
  className?: string
}

const AVATAR_SCALE = 0.68
const AVATAR_W = 64 * AVATAR_SCALE
const AVATAR_H = 72 * AVATAR_SCALE
const LABEL_MAX = 4

/** 인원수별 바닥 중앙 좌표. 집(120~298)을 피해 좌우에 배치한다. */
const SPOTS: Record<number, Array<[number, number]>> = {
  1: [[262, 210]],
  2: [
    [68, 206],
    [266, 210],
  ],
  3: [
    [68, 206],
    [252, 210],
    [306, 208],
  ],
  4: [
    [68, 206],
    [238, 210],
    [292, 208],
    [346, 206],
  ],
}

function shortName(name: string) {
  const chars = Array.from(name)
  return chars.length > LABEL_MAX ? `${chars.slice(0, LABEL_MAX).join("")}…` : name
}

/**
 * 오리지널 2.5D 미니어처 집 장면. SVG는 장식이고, 캐릭터 위에 투명한 실제 버튼을 겹쳐
 * 터치·키보드 모두 같은 동작을 한다. 모션은 없어서 reduced-motion에서도 그대로 정지 장면이다.
 */
export function FamilyHouseScene({
  family,
  stage,
  maxVisible = 4,
  onMemberSelect,
  onMoreSelect,
  className,
}: FamilyHouseSceneProps) {
  const limit = Math.max(1, Math.min(4, maxVisible))
  const visible = family.members.slice(0, limit)
  const rest = family.members.length - visible.length
  const spots = SPOTS[visible.length] ?? SPOTS[4]

  return (
    <section
      aria-label="우리집 장면"
      className={`relative -mx-4 aspect-[5/3] max-h-[270px] w-[calc(100%+--spacing(8))] overflow-hidden bg-scene-sky ${className ?? ""}`}
    >
      <svg
        viewBox={`0 0 ${SCENE_BOX.width} ${SCENE_BOX.height}`}
        preserveAspectRatio="xMidYMax meet"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
        focusable="false"
      >
        <SkyLayer rainbow={stage >= 5} />
        <GroundLayer />
        {stage >= 4 && <GardenLayer />}
        <HouseLayer />
        <MailboxLayer />
        {stage >= 2 && <PlanterLayer />}
        {stage >= 3 && <FlowersLayer />}
        {stage >= 5 && <GarlandLayer />}
        {visible.map((m, i) => {
          const [x, y] = spots[i]
          // 이웃한 이름표가 겹치지 않도록 홀수 번째는 한 칸 아래
          const labelY = y + (i % 2 === 0 ? 3 : 16)
          const label = shortName(m.name)
          const width = Array.from(label).length * 11 + 12
          return (
            <g key={m.id}>
              <SceneAvatar x={x} y={y} scale={AVATAR_SCALE} tone={m.tone} config={m.avatar} />
              <rect x={x - width / 2} y={labelY} width={width} height="15" rx="7.5" fill="var(--card)" opacity="0.92" />
              <text
                x={x}
                y={labelY + 11}
                textAnchor="middle"
                fontSize="11"
                fontWeight="600"
                fill="var(--foreground)"
              >
                {label}
              </text>
            </g>
          )
        })}
      </svg>

      {/* 캐릭터 위 실제 버튼(투명). 좌표는 viewBox 기준 %로 맞춘다. */}
      <ul className="absolute inset-0 m-0 list-none p-0">
        {visible.map((m, i) => {
          const [x, y] = spots[i]
          const w = Math.max(AVATAR_W, 48)
          const h = AVATAR_H + 26
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={(e) => onMemberSelect(m.id, e.currentTarget)}
                aria-label={`${m.name} 프로필 보기`}
                className="absolute rounded-full outline-none hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-ring/70 active:bg-foreground/10"
                style={{
                  left: `${((x - w / 2) / SCENE_BOX.width) * 100}%`,
                  top: `${((y - AVATAR_H - 4) / SCENE_BOX.height) * 100}%`,
                  width: `${(w / SCENE_BOX.width) * 100}%`,
                  height: `${(h / SCENE_BOX.height) * 100}%`,
                }}
              />
            </li>
          )
        })}
      </ul>

      {rest > 0 && (
        <Button
          variant="outline"
          size="icon"
          className="absolute top-3 right-3 rounded-full text-sm font-semibold"
          onClick={(e) => onMoreSelect(e.currentTarget)}
        >
          +{rest}
          <span className="sr-only">명 더 보기</span>
        </Button>
      )}
    </section>
  )
}
