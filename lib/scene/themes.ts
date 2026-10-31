/**
 * 가족 공통 테마 카탈로그. `public/assets/pixel/themes/<id>/`에 실제 파일이 있는 5종만 둔다.
 * 테마는 홈 장면의 배경 레이어만 바꾸며 캐릭터·일정·사진·집안일·메시지에는 영향을 주지 않는다.
 */
export const SCENE_THEMES = [
  { id: "sunny-garden", name: "햇살 정원", description: "따뜻한 주택과 넓은 잔디 마당" },
  { id: "city-house", name: "도시의 작은 집", description: "정돈된 테라스와 저녁 도시 풍경" },
  { id: "forest-cabin", name: "숲속 오두막", description: "목재 오두막과 고요한 숲의 공기" },
  { id: "blossom-hill", name: "벚꽃 언덕집", description: "둥근 창과 분홍 꽃나무가 있는 언덕집" },
  { id: "night-terrace", name: "별빛 테라스", description: "깊은 남색 지붕과 은은한 야외 조명" },
] as const

export type SceneTheme = (typeof SCENE_THEMES)[number]["id"]

export const DEFAULT_THEME: SceneTheme = "sunny-garden"

/** 원본 SVG viewBox(130×140). 장면 비율은 13/14. */
export const SCENE_ASPECT = { width: 13, height: 14 } as const

/** 캐릭터 뒤에 깔리는 레이어(아래→위). `05_front`는 캐릭터 앞에 덮는다. */
export const SCENE_BACK_LAYERS = ["01_sky", "02_far", "03_ground", "04_house"] as const
export const SCENE_FRONT_LAYER = "05_front"

export function isSceneTheme(value: unknown): value is SceneTheme {
  return typeof value === "string" && SCENE_THEMES.some((t) => t.id === value)
}

export function themeInfo(id: SceneTheme) {
  return SCENE_THEMES.find((t) => t.id === id) ?? SCENE_THEMES[0]
}

export function themeLayerSrc(theme: SceneTheme, layer: (typeof SCENE_BACK_LAYERS)[number] | typeof SCENE_FRONT_LAYER | "background") {
  return `/assets/pixel/themes/${theme}/${layer}.svg`
}
