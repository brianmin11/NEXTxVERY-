"use client"

import * as React from "react"

import { SCENE_BOX } from "./house-layers"
import type { PauseReason } from "./use-pause-reasons"

/**
 * 캐릭터 발 위치가 머무는 마당(장면 좌표, 0 0 400 240).
 * 집 바닥은 y≈150이고 집 발자국은 x 128~272, y<176 이므로
 * 이 사각형 안의 두 점을 잇는 직선은 집을 지나지 않는다.
 * 아래 여백은 이름표(발 아래 ~20)가 잘리지 않을 만큼 남긴다.
 */
export const YARD = { minX: 38, maxX: 362, minY: 168, maxY: 218 } as const

/** 캐릭터 래퍼 크기(장면 좌표). 발은 래퍼 위에서 feetY 아래 */
export const WALKER_BOX = { width: 48, feetY: 46, height: 64 } as const

export type WalkState = "idle" | "walking" | "running"
type Facing = "left" | "right"

type Walker = {
  x: number
  y: number
  tx: number
  ty: number
  state: WalkState
  waitUntil: number
  facing: Facing
}

const SPEED: Record<Exclude<WalkState, "idle">, number> = { walking: 16, running: 44 }
const MAX_FRAME_MS = 50

/** 시작 위치: 서로 다른 x, 앞뒤 두 줄로 엇갈리게 */
export function initialSpot(index: number, count: number): [number, number] {
  const span = YARD.maxX - YARD.minX - 40
  const x = count === 1 ? 200 : YARD.minX + 20 + (span * index) / (count - 1)
  const y = index % 2 === 0 ? 182 : 208
  return [x, y]
}

function pickTarget(w: Walker, now: number) {
  const running = Math.random() < 0.15
  const [minDist, maxDist] = running ? [60, 130] : [35, 170]
  let best: [number, number] | null = null
  for (let i = 0; i < 10; i++) {
    const x = YARD.minX + Math.random() * (YARD.maxX - YARD.minX)
    const y = YARD.minY + Math.random() * (YARD.maxY - YARD.minY)
    const d = Math.hypot(x - w.x, y - w.y)
    if (d >= minDist && d <= maxDist) {
      best = [x, y]
      break
    }
    if (!best || d >= minDist) best = [x, y]
  }
  const [tx, ty] = best ?? [w.x, w.y]
  w.tx = tx
  w.ty = ty
  w.state = running ? "running" : "walking"
  if (Math.abs(tx - w.x) > 2) w.facing = tx < w.x ? "left" : "right"
  w.waitUntil = now
}

function step(w: Walker, dt: number, now: number) {
  if (w.state === "idle") {
    if (now >= w.waitUntil) pickTarget(w, now)
    return
  }
  const dx = w.tx - w.x
  const dy = w.ty - w.y
  const dist = Math.hypot(dx, dy)
  const move = SPEED[w.state] * dt
  if (dist <= move || dist < 0.5) {
    w.x = w.tx
    w.y = w.ty
    w.state = "idle"
    w.waitUntil = now + 1500 + Math.random() * 4000
    return
  }
  w.x += (dx / dist) * move
  w.y += (dy / dist) * move
}

type Options = {
  containerRef: React.RefObject<HTMLElement | null>
  count: number
  /** usePauseReasons().paused */
  paused: boolean
  /** 탭 숨김·화면 밖 같은 자동 사유를 보고한다 */
  setAutoReason: (reason: Extract<PauseReason, "hidden" | "offscreen">, on: boolean) => void
}

/**
 * 하나의 requestAnimationFrame 루프로 모든 캐릭터를 움직인다.
 * React 상태를 매 프레임 바꾸지 않고 래퍼 요소의 transform만 직접 쓴다.
 * paused면 루프를 멈추고, 재개 시 경과 시간을 0부터 세어 순간이동하지 않는다.
 */
export function useYardMotion({ containerRef, count, paused, setAutoReason }: Options) {
  const walkers = React.useRef<Walker[]>([])
  const els = React.useRef<(HTMLElement | null)[]>([])
  const size = React.useRef({ w: 0, h: 0 })
  // 루프 effect에서만 갱신한다(렌더 중 ref 쓰기 금지).
  const pausedRef = React.useRef(paused)

  const apply = React.useCallback(() => {
    const s = size.current.w / SCENE_BOX.width
    if (!s) return
    const frozen = pausedRef.current
    walkers.current.forEach((w, i) => {
      const el = els.current[i]
      if (!el) return
      el.style.left = "0px"
      el.style.top = "0px"
      el.style.transform = `translate3d(${((w.x - WALKER_BOX.width / 2) * s).toFixed(1)}px, ${((w.y - WALKER_BOX.feetY) * s).toFixed(1)}px, 0)`
      const z = String(Math.round(w.y))
      if (el.style.zIndex !== z) el.style.zIndex = z
      const walk = frozen ? "idle" : w.state
      if (el.dataset.walk !== walk) el.dataset.walk = walk
      if (el.dataset.facing !== w.facing) el.dataset.facing = w.facing
    })
  }, [])

  const register = React.useCallback(
    (index: number) => (el: HTMLElement | null) => {
      els.current[index] = el
    },
    []
  )

  // 인원이 바뀌면 걷는 사람 목록을 새로 만든다.
  React.useEffect(() => {
    const now = performance.now()
    walkers.current = Array.from({ length: count }, (_, i) => {
      const [x, y] = initialSpot(i, count)
      return {
        x,
        y,
        tx: x,
        ty: y,
        state: "idle" as const,
        facing: i % 2 === 0 ? ("right" as const) : ("left" as const),
        // 서로 다른 때에 출발
        waitUntil: now + 600 + i * 900 + Math.random() * 1200,
      }
    })
    els.current.length = count
    apply()
  }, [count, apply])

  // 컨테이너 크기가 바뀌면 같은 장면 좌표를 새 픽셀로 다시 놓는다.
  React.useEffect(() => {
    const node = containerRef.current
    if (!node) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect
      if (!r) return
      size.current = { w: r.width, h: r.height }
      apply()
    })
    ro.observe(node)
    return () => ro.disconnect()
  }, [containerRef, apply])

  // 탭 숨김·장면이 화면 밖이면 멈춘다.
  React.useEffect(() => {
    const onVisibility = () => setAutoReason("hidden", document.hidden)
    document.addEventListener("visibilitychange", onVisibility)
    onVisibility()
    const node = containerRef.current
    const io = node
      ? new IntersectionObserver(([entry]) => setAutoReason("offscreen", !entry.isIntersecting), { threshold: 0.05 })
      : null
    if (node && io) io.observe(node)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      io?.disconnect()
      setAutoReason("hidden", false)
      setAutoReason("offscreen", false)
    }
  }, [containerRef, setAutoReason])

  // 단일 rAF 루프
  React.useEffect(() => {
    pausedRef.current = paused
    if (paused) {
      apply() // 걷기 애니메이션을 idle로 내린다
      return
    }
    let raf = 0
    let last: number | null = null
    const tick = (now: number) => {
      if (last === null) last = now
      const dt = Math.min(now - last, MAX_FRAME_MS) / 1000
      last = now
      for (const w of walkers.current) step(w, dt, now)
      apply()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [paused, apply])

  return { register }
}
