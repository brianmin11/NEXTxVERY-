"use client"

import * as React from "react"

/**
 * DialogTrigger 없이 상태로 여는 모달은 Radix가 닫힌 뒤 포커스를 돌려주지 않는다.
 * 열기 직전에 포커스된 요소를 기억했다가 onCloseAutoFocus에서 직접 돌려준다.
 * 그 요소가 사라졌으면(예: 응답 후 버튼 제거) fallback으로 보낸다.
 * 메모이제이션은 React Compiler에 맡긴다.
 */
export function useReturnFocus(fallback?: React.RefObject<HTMLElement | null>) {
  const ref = React.useRef<HTMLElement | null>(null)

  function capture(origin?: HTMLElement | null) {
    ref.current = origin ?? (document.activeElement as HTMLElement | null)
  }

  function onCloseAutoFocus(event: Event) {
    const target = ref.current && ref.current.isConnected ? ref.current : fallback?.current
    if (target) {
      event.preventDefault()
      target.focus()
    }
  }

  return { capture, onCloseAutoFocus }
}
