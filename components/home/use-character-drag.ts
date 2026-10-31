"use client"

import * as React from "react"

import { clampSpot, type SceneSpot } from "@/lib/scene/spots"

/** 이 거리(px)보다 적게 움직이면 탭으로 본다 */
const TAP_THRESHOLD = 7

type DragState = {
  pointerId: number
  startX: number
  startY: number
  moved: boolean
  lastX: number
}

type Options = {
  /** 장면 요소(백분율 계산 기준) */
  sceneRef: React.RefObject<HTMLElement | null>
  onMove: (spot: SceneSpot) => void
  onTap: (origin: HTMLElement) => void
  onDragEnd?: () => void
}

/**
 * 캐릭터 드래그. 포인터를 잡고 7px 이상 움직이면 드래그, 아니면 탭이다.
 * 드래그 중에는 세로 스크롤을 막고(touch-action: none), 포인터 캡처로 손가락이 벗어나도 따라간다.
 * 취소(pointercancel·Escape)되면 시작 위치로 되돌린다.
 */
export function useCharacterDrag({ sceneRef, onMove, onTap, onDragEnd }: Options) {
  const drag = React.useRef<DragState | null>(null)
  const startSpot = React.useRef<SceneSpot | null>(null)
  const [dragging, setDragging] = React.useState(false)
  const [tilt, setTilt] = React.useState<-1 | 0 | 1>(0)

  function toSpot(clientX: number, clientY: number): SceneSpot | null {
    const scene = sceneRef.current
    if (!scene) return null
    const box = scene.getBoundingClientRect()
    if (box.width === 0 || box.height === 0) return null
    return clampSpot({ x: ((clientX - box.left) / box.width) * 100, y: ((clientY - box.top) / box.height) * 100 })
  }

  function finish(cancelled: boolean) {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (d.moved) {
      if (cancelled && startSpot.current) onMove(startSpot.current)
      setDragging(false)
      setTilt(0)
      onDragEnd?.()
    }
    startSpot.current = null
  }

  const handlers = {
    onPointerDown: (e: React.PointerEvent<HTMLElement>, current: SceneSpot) => {
      if (e.button !== 0 && e.pointerType === "mouse") return
      drag.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false, lastX: e.clientX }
      startSpot.current = current
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const d = drag.current
      if (!d || d.pointerId !== e.pointerId) return
      if (!d.moved) {
        if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) <= TAP_THRESHOLD) return
        d.moved = true
        setDragging(true)
      }
      const dx = e.clientX - d.lastX
      if (Math.abs(dx) > 1) setTilt(dx > 0 ? 1 : -1)
      d.lastX = e.clientX
      const spot = toSpot(e.clientX, e.clientY)
      if (spot) onMove(spot)
    },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
      const d = drag.current
      if (!d || d.pointerId !== e.pointerId) return
      const wasTap = !d.moved
      finish(false)
      if (wasTap) onTap(e.currentTarget)
    },
    onPointerCancel: (e: React.PointerEvent<HTMLElement>) => {
      const d = drag.current
      if (!d || d.pointerId !== e.pointerId) return
      finish(true)
    },
    onLostPointerCapture: () => {
      // 시스템이 포인터를 가져가면(예: 스크롤 제스처) 드래그를 취소한다.
      if (drag.current?.moved) finish(true)
      else drag.current = null
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === "Escape" && drag.current?.moved) {
        e.preventDefault()
        finish(true)
      }
    },
  }

  return { dragging, tilt, handlers }
}
