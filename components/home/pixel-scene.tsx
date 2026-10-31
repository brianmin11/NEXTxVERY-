"use client"

import * as React from "react"
import { UsersRound } from "lucide-react"

import { PixelCharacter } from "@/components/character/pixel-character"
import type { Family, FamilyMember } from "@/lib/family/types"
import { SCENE_ASPECT, SCENE_BACK_LAYERS, SCENE_FRONT_LAYER, themeInfo, themeLayerSrc, type SceneTheme } from "@/lib/scene/themes"
import { clampSpot, SPOT_STEP, type SceneSpot } from "@/lib/scene/spots"
import { cn } from "@/lib/utils"

import { useCharacterDrag } from "./use-character-drag"

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"
function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION_QUERY)
  mq.addEventListener("change", onChange)
  return () => mq.removeEventListener("change", onChange)
}
function getReducedMotion() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

/** 캐릭터 폭 = 장면 폭의 이 비율(390px에서 약 58px, 원본 60px) */
const CHARACTER_WIDTH_RATIO = 0.15
const LABEL_MAX = 5

function shortName(name: string) {
  const chars = Array.from(name)
  return chars.length > LABEL_MAX ? `${chars.slice(0, LABEL_MAX).join("")}…` : name
}

type PixelSceneProps = {
  family: Family
  theme: SceneTheme
  viewerId: string
  /** 집 앞에 보여줄 최대 인원. 현재 인물은 항상 포함한다. */
  maxVisible?: number
  spotOf: (memberId: string) => SceneSpot
  onMove: (memberId: string, spot: SceneSpot) => void
  onMemberSelect: (memberId: string, origin: HTMLElement) => void
  className?: string
}

/** 집 앞에 보일 구성원: 현재 인물 + 순서대로 나머지 */
export function visibleMembers(family: Family, viewerId: string, max: number) {
  const limit = Math.max(1, Math.min(4, max))
  if (family.members.length <= limit) return family.members
  const viewer = family.members.find((m) => m.id === viewerId)
  const rest = family.members.filter((m) => m.id !== viewerId)
  const picked = viewer ? [viewer, ...rest.slice(0, limit - 1)] : rest.slice(0, limit)
  // 원래 순서를 유지해 겹침·탭 순서가 예측 가능하게 한다.
  return family.members.filter((m) => picked.includes(m))
}

/**
 * 픽셀 테마 장면(13:14). 배경 4장 → 캐릭터 → 앞 레이어 1장 순으로 겹친다.
 * 캐릭터는 평소 정지해 있고, 잡고 끌 때만 살짝 들리며 기울어진다(자동 걷기·흔들림 없음).
 * 키보드 방향키와 프로필 시트의 버튼으로도 옮길 수 있다(드래그 대체 수단).
 */
export function PixelScene({ family, theme, viewerId, maxVisible = 4, spotOf, onMove, onMemberSelect, className }: PixelSceneProps) {
  const sceneRef = React.useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = React.useState(390)
  const [announce, setAnnounce] = React.useState("")
  const reducedMotion = React.useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false)
  const info = themeInfo(theme)
  const visible = visibleMembers(family, viewerId, maxVisible)
  const characterSize = Math.round(((width * CHARACTER_WIDTH_RATIO) * 28) / 20)

  React.useEffect(() => {
    const el = sceneRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  function nudge(member: FamilyMember, dx: number, dy: number) {
    const next = clampSpot({ x: spotOf(member.id).x + dx, y: spotOf(member.id).y + dy })
    onMove(member.id, next)
    setAnnounce(`${member.name} 위치를 옮겼어요. 가로 ${Math.round(next.x)}%, 앞뒤 ${Math.round(next.y)}%`)
  }

  return (
    <div className={cn("relative", className)}>
      <div
        ref={sceneRef}
        role="group"
        aria-label={`우리집 장면 · ${info.name}`}
        className="relative isolate w-full overflow-hidden bg-home-scene shadow-scene"
        style={{ aspectRatio: `${SCENE_ASPECT.width} / ${SCENE_ASPECT.height}`, touchAction: "pan-y" }}
      >
        <div aria-hidden="true" className="absolute inset-0">
          {SCENE_BACK_LAYERS.map((layer) => (
            // eslint-disable-next-line @next/next/no-img-element -- 정적 픽셀 SVG 레이어
            <img key={layer} src={themeLayerSrc(theme, layer)} alt="" draggable={false} className="pixelated absolute inset-0 block h-full w-full" />
          ))}
        </div>

        <ul className="absolute inset-0 m-0 list-none p-0" aria-label="가족 캐릭터">
          {visible.map((m) => (
            <SceneCharacter
              key={m.id}
              member={m}
              me={m.id === viewerId}
              spot={spotOf(m.id)}
              size={characterSize}
              sceneRef={sceneRef}
              reducedMotion={reducedMotion}
              onMove={(spot) => onMove(m.id, spot)}
              onNudge={(dx, dy) => nudge(m, dx, dy)}
              onSelect={(origin) => onMemberSelect(m.id, origin)}
            />
          ))}
        </ul>

        {/* eslint-disable-next-line @next/next/no-img-element -- 캐릭터 앞에 덮는 정적 레이어 */}
        <img
          src={themeLayerSrc(theme, SCENE_FRONT_LAYER)}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="pixelated pointer-events-none absolute inset-0 z-20 block h-full w-full"
        />

        <div className="pointer-events-none absolute top-3 left-3 z-30 flex items-center gap-1.5 rounded-full border border-card/80 bg-home-hud py-1 pr-1.5 pl-3 text-xs font-bold text-card shadow-card backdrop-blur-sm">
          <span>{info.name}</span>
          <span className="flex items-center gap-1 rounded-full bg-card/15 px-2 py-0.5 font-semibold">
            <UsersRound className="size-3" aria-hidden="true" />
            가족 {family.members.length}명
          </span>
        </div>
        <p
          aria-hidden="true"
          className="pointer-events-none absolute bottom-1.5 left-1/2 z-30 -translate-x-1/2 rounded-full bg-home-hud px-3 py-1 text-xs whitespace-nowrap text-card backdrop-blur-sm"
        >
          캐릭터를 눌러 이야기하거나 끌어서 옮겨 보세요
        </p>
      </div>
      <p id="scene-move-hint" className="sr-only">
        캐릭터를 끌어서 옮기거나, 포커스한 뒤 방향키로 옮길 수 있어요. 프로필 시트의 위치 버튼으로도 옮겨요.
      </p>
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  )
}

type SceneCharacterProps = {
  member: FamilyMember
  me: boolean
  spot: SceneSpot
  size: number
  sceneRef: React.RefObject<HTMLDivElement | null>
  reducedMotion: boolean
  onMove: (spot: SceneSpot) => void
  onNudge: (dx: number, dy: number) => void
  onSelect: (origin: HTMLElement) => void
}

function SceneCharacter({ member, me, spot, size, sceneRef, reducedMotion, onMove, onNudge, onSelect }: SceneCharacterProps) {
  const { dragging, tilt, handlers } = useCharacterDrag({ sceneRef, onMove, onTap: onSelect })
  const reacting = dragging && !reducedMotion
  const transform = reacting ? `translateY(-6px) rotate(${tilt * 5}deg)` : undefined

  return (
    <li
      className="absolute m-0 p-0"
      style={{ left: `${spot.x}%`, top: `${spot.y}%`, zIndex: 10 + Math.round(spot.y), transform: "translate(-50%, -100%)" }}
    >
      <button
        type="button"
        aria-label={`${member.name} 프로필 보기${me ? " (나)" : ""}. 끌거나 방향키로 위치를 옮길 수 있어요`}
        aria-describedby="scene-move-hint"
        data-dragging={dragging || undefined}
        onPointerDown={(e) => handlers.onPointerDown(e, spot)}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handlers.onPointerUp}
        onPointerCancel={handlers.onPointerCancel}
        onLostPointerCapture={handlers.onLostPointerCapture}
        onKeyDown={(e) => {
          handlers.onKeyDown(e)
          const step = e.shiftKey ? 3 : 1
          const map: Record<string, [number, number]> = {
            ArrowLeft: [-SPOT_STEP.x * step, 0],
            ArrowRight: [SPOT_STEP.x * step, 0],
            ArrowUp: [0, -SPOT_STEP.y * step],
            ArrowDown: [0, SPOT_STEP.y * step],
          }
          const delta = map[e.key]
          if (delta) {
            e.preventDefault()
            onNudge(delta[0], delta[1])
          }
        }}
        className={cn(
          "relative flex min-h-11 min-w-11 cursor-grab flex-col items-center rounded-lg outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/80",
          dragging && "cursor-grabbing"
        )}
        style={{ touchAction: "none" }}
      >
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-1/2 h-2 w-10 -translate-x-1/2 rounded-full bg-foreground/20 blur-[2px] transition-[opacity,transform]"
          style={{ transform: `translateX(-50%) scale(${reacting ? 1.25 : 1})`, opacity: reacting ? 0.6 : 0.9 }}
        />
        <span className="block transition-transform duration-150 ease-ui" style={{ transform }}>
          <PixelCharacter config={member.avatar} name={member.name} size={size} decorative className="drop-shadow-[0_4px_2px_rgb(29_36_29_/_0.25)]" />
        </span>
      </button>
      <span
        aria-hidden="true"
        className="absolute top-full left-1/2 mt-0.5 flex max-w-24 -translate-x-1/2 items-center gap-1 rounded-full border border-card/70 bg-foreground/85 px-2 py-0.5 text-xs font-bold whitespace-nowrap text-card"
      >
        <span className="truncate">{shortName(member.name)}</span>
        {me && <span className="text-secondary">나</span>}
      </span>
    </li>
  )
}
