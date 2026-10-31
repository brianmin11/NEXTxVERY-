"use client"

import * as React from "react"

/** 장면 모션을 멈추는 이유. 하나라도 남아 있으면 멈춘다. */
export type PauseReason = "user" | "hover" | "focus" | "pointer" | "sheet" | "hidden" | "offscreen"

export type PauseApi = {
  add: (reason: PauseReason) => void
  remove: (reason: PauseReason) => void
  /** 사유가 하나라도 있으면 true */
  paused: boolean
}

/**
 * 정지 사유를 한곳에서 관리한다.
 * hover가 끝나도 시트가 열려 있으면 계속 멈추고, 모든 사유가 해제될 때만 재개된다.
 */
export function usePauseReasons(): PauseApi {
  const reasons = React.useRef(new Set<PauseReason>())
  const [paused, setPaused] = React.useState(false)

  const add = React.useCallback((reason: PauseReason) => {
    if (reasons.current.has(reason)) return
    reasons.current.add(reason)
    setPaused(true)
  }, [])

  const remove = React.useCallback((reason: PauseReason) => {
    if (!reasons.current.delete(reason)) return
    setPaused(reasons.current.size > 0)
  }, [])

  return { add, remove, paused }
}
