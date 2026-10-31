"use client"

import * as React from "react"
import { Pause, Play } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { Family } from "@/lib/home.fixture"

import { FamilyAvatar } from "./family-avatar"
import {
  FlowersLayer,
  GardenLayer,
  GarlandLayer,
  GroundLayer,
  HOUSE_TRANSFORM,
  HouseLayer,
  HouseShadowLayer,
  MailboxLayer,
  PlanterLayer,
  SCENE_BOX,
  SkyLayer,
  type HouseStage,
} from "./house-layers"
import { usePauseReasons } from "./use-pause-reasons"
import { initialSpot, useYardMotion, WALKER_BOX } from "./use-yard-motion"

type FamilyHouseSceneProps = {
  family: Family
  /** 시각 상태 ID. 산정 정책은 미정이며 장면은 이 값만 본다. */
  stage: HouseStage
  /** 집 앞에 보여줄 최대 인원(UI 설정). 가족 인원 자체를 제한하지 않는다. */
  maxVisible?: number
  /** origin은 시트를 닫은 뒤 포커스를 돌려줄 요소 */
  onMemberSelect: (memberId: string, origin: HTMLElement) => void
  onMoreSelect: (origin: HTMLElement) => void
  /** 상세 시트가 열려 있는 동안 true → 이동을 멈춘다 */
  motionPaused?: boolean
  className?: string
}

const LABEL_MAX = 4
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION_QUERY)
  mq.addEventListener("change", onChange)
  return () => mq.removeEventListener("change", onChange)
}
function getReducedMotion() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

function shortName(name: string) {
  const chars = Array.from(name)
  return chars.length > LABEL_MAX ? `${chars.slice(0, LABEL_MAX).join("")}…` : name
}

/**
 * 오리지널 2.5D SVG 집 장면(시안). 작은 집은 뒤쪽 중앙에 고정되고,
 * 가족 캐릭터는 앞마당에서 각자 다른 경로·대기 시간으로 천천히 움직인다.
 * 캐릭터·이름표·클릭 영역은 하나의 버튼 래퍼로 함께 움직이고,
 * hover·focus·pointerdown·시트 열림·탭 숨김·화면 밖·사용자 정지 중에는 멈춘다.
 * 움직임은 시각적 연출일 뿐 접속 여부나 감정 상태를 뜻하지 않는다.
 */
export function FamilyHouseScene({
  family,
  stage,
  maxVisible = 4,
  onMemberSelect,
  onMoreSelect,
  motionPaused = false,
  className,
}: FamilyHouseSceneProps) {
  const limit = Math.max(1, Math.min(4, maxVisible))
  const visible = family.members.slice(0, limit)
  const rest = family.members.length - visible.length

  const containerRef = React.useRef<HTMLElement | null>(null)
  const pause = usePauseReasons()
  const { add, remove } = pause

  // reduced-motion이면 기본 정지. 사용자가 버튼으로 바꾸면 그 선택이 우선한다.
  const prefersReducedMotion = React.useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false)
  const [userOverride, setUserOverride] = React.useState<boolean | null>(null)
  const userPaused = userOverride ?? prefersReducedMotion

  React.useEffect(() => {
    if (userPaused) add("user")
    else remove("user")
  }, [userPaused, add, remove])
  React.useEffect(() => {
    if (motionPaused) add("sheet")
    else remove("sheet")
  }, [motionPaused, add, remove])

  // pointerdown은 창 어디서 떼더라도 해제한다.
  React.useEffect(() => {
    const release = () => remove("pointer")
    window.addEventListener("pointerup", release)
    window.addEventListener("pointercancel", release)
    return () => {
      window.removeEventListener("pointerup", release)
      window.removeEventListener("pointercancel", release)
    }
  }, [remove])

  const setAutoReason = React.useCallback(
    (reason: "hidden" | "offscreen", on: boolean) => (on ? add(reason) : remove(reason)),
    [add, remove]
  )
  const { register } = useYardMotion({ containerRef, count: visible.length, paused: pause.paused, setAutoReason })

  return (
    <section
      ref={containerRef}
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
        {/* 집과 장식은 같은 앵커·비율로 묶여 단계가 바뀌어도 위치가 같다 */}
        <g transform={HOUSE_TRANSFORM}>
          <HouseShadowLayer />
          {stage >= 4 && <GardenLayer />}
          <HouseLayer />
          <MailboxLayer />
          {stage >= 2 && <PlanterLayer />}
          {stage >= 3 && <FlowersLayer />}
          {stage >= 5 && <GarlandLayer />}
        </g>
      </svg>

      {/* 캐릭터: 그림·이름표·버튼이 한 래퍼로 움직인다 */}
      <ul className="absolute inset-0 m-0 list-none p-0">
        {visible.map((m, i) => {
          const [x, y] = initialSpot(i, visible.length)
          return (
            <li key={m.id} className="contents">
              <button
                ref={register(i)}
                type="button"
                data-walk="idle"
                data-facing={i % 2 === 0 ? "right" : "left"}
                onClick={(e) => onMemberSelect(m.id, e.currentTarget)}
                onPointerEnter={() => add("hover")}
                onPointerLeave={() => remove("hover")}
                onPointerDown={() => add("pointer")}
                onFocus={() => add("focus")}
                onBlur={() => remove("focus")}
                aria-label={`${m.name} 프로필 보기`}
                className="absolute flex min-w-11 flex-col items-center gap-0.5 rounded-full outline-none will-change-transform hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-ring/70 active:bg-foreground/10"
                style={{
                  width: `${(WALKER_BOX.width / SCENE_BOX.width) * 100}%`,
                  height: `${(WALKER_BOX.height / SCENE_BOX.height) * 100}%`,
                  left: `${((x - WALKER_BOX.width / 2) / SCENE_BOX.width) * 100}%`,
                  top: `${((y - WALKER_BOX.feetY) / SCENE_BOX.height) * 100}%`,
                  zIndex: Math.round(y),
                }}
              >
                <span className="yard-body block w-[85%]">
                  <FamilyAvatar member={m} size={46} decorative className="h-auto w-full" />
                </span>
                <span
                  aria-hidden="true"
                  className="max-w-full truncate rounded-full bg-card/90 px-1.5 text-[11px] leading-4 font-semibold text-foreground"
                >
                  {shortName(m.name)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <Button
        variant="outline"
        size="icon"
        className="absolute top-3 left-3 rounded-full"
        aria-pressed={userPaused}
        aria-label={userPaused ? "움직임 켜기" : "움직임 멈추기"}
        onClick={() => setUserOverride(!userPaused)}
      >
        {userPaused ? <Play className="size-5" aria-hidden="true" /> : <Pause className="size-5" aria-hidden="true" />}
      </Button>

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
