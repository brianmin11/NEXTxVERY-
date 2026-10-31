/**
 * 마당 위 캐릭터 위치. 장면 폭·높이에 대한 백분율이며 y는 발바닥 위치다.
 * 집 앞 마당(아래쪽 띠)에만 머물도록 범위를 제한한다(원본 Figma 값: x 7~93, y 78~96).
 */
export type SceneSpot = { x: number; y: number }

export const SPOT_BOUNDS = { minX: 8, maxX: 92, minY: 74, maxY: 88 } as const

/** 키보드·버튼으로 옮길 때 한 번에 움직이는 양(%) */
export const SPOT_STEP = { x: 4, y: 3 } as const

export function clampSpot(spot: SceneSpot): SceneSpot {
  return {
    x: Math.min(SPOT_BOUNDS.maxX, Math.max(SPOT_BOUNDS.minX, Math.round(spot.x * 10) / 10)),
    y: Math.min(SPOT_BOUNDS.maxY, Math.max(SPOT_BOUNDS.minY, Math.round(spot.y * 10) / 10)),
  }
}

/** 시작 위치: 서로 다른 x, 앞뒤 두 줄로 엇갈리게 */
export function defaultSpot(index: number, count: number): SceneSpot {
  const visible = Math.min(count, 4)
  const slot = index % 4
  const x = visible <= 1 ? 50 : 18 + (64 * slot) / (visible - 1)
  const y = slot % 2 === 0 ? 86 : 79
  return clampSpot({ x, y })
}
