/**
 * 캐릭터 레이어 카탈로그. `public/assets/pixel/characters/*`에 실제로 서로 다른 파일이 있는 항목만 둔다.
 * 얼굴은 `face_smile` 1종뿐이라 선택지로 노출하지 않는다(표정 변화는 자산이 생긴 뒤 추가).
 * id는 파일 이름에서 따온 안정적인 값이며 화면 문구와 분리한다.
 */

export const SKIN_OPTIONS = [
  { id: "skin1", label: "포슬린", file: "body_skin1", swatch: "#f4d2c1" },
  { id: "skin2", label: "라이트", file: "body_skin2", swatch: "#e9bda5" },
  { id: "skin3", label: "피치", file: "body_skin3", swatch: "#dfa88e" },
  { id: "skin4", label: "웜", file: "body_skin4", swatch: "#cf9477" },
  { id: "skin5", label: "탠", file: "body_skin5", swatch: "#a96f54" },
] as const

export const HAIR_OPTIONS = [
  { id: "bob_brown", label: "단정한 단발", file: "hair_bob_brown" },
  { id: "sidepart_darkbrown", label: "가르마 쇼트", file: "hair_sidepart_darkbrown" },
  { id: "bun_black", label: "높은 번", file: "hair_bun_black" },
  { id: "short_black", label: "클래식 쇼트", file: "hair_short_black" },
  { id: "long_black", label: "긴 생머리", file: "hair_long_black" },
  { id: "curly_darkbrown", label: "풍성한 컬", file: "hair_curly_darkbrown" },
  { id: "ponytail_brown", label: "포니테일", file: "hair_ponytail_brown" },
  { id: "bangs_chestnut", label: "앞머리 밤색", file: "hair_bangs_chestnut" },
] as const

export const OUTFIT_OPTIONS = [
  { id: "sweater", label: "세이지 니트", file: "outfit_sweater", swatch: "#6f947e" },
  { id: "hoodie", label: "네이비 후디", file: "outfit_hoodie", swatch: "#3c566c" },
  { id: "cardigan", label: "코랄 카디건", file: "outfit_cardigan", swatch: "#cf7766" },
  { id: "overalls", label: "크림 오버롤", file: "outfit_overalls", swatch: "#c9ad7e" },
  { id: "jacket", label: "데님 재킷", file: "outfit_jacket", swatch: "#52758a" },
  { id: "dress", label: "플럼 원피스", file: "outfit_dress", swatch: "#76566f" },
  { id: "shirt", label: "머스터드 셔츠", file: "outfit_shirt", swatch: "#b8873f" },
  { id: "stripes", label: "줄무늬 티", file: "outfit_stripes", swatch: "#68a393" },
] as const

export const ACCESSORY_OPTIONS = [
  { id: "none", label: "없음", file: null },
  { id: "beanie", label: "비니", file: "acc_beanie" },
  { id: "cap", label: "캡 모자", file: "acc_cap" },
  { id: "glasses", label: "안경", file: "acc_glasses" },
  { id: "headphones", label: "헤드폰", file: "acc_headphones" },
  { id: "ribbon", label: "리본", file: "acc_ribbon" },
] as const

export type SkinId = (typeof SKIN_OPTIONS)[number]["id"]
export type HairId = (typeof HAIR_OPTIONS)[number]["id"]
export type OutfitId = (typeof OUTFIT_OPTIONS)[number]["id"]
export type AccessoryId = (typeof ACCESSORY_OPTIONS)[number]["id"]

/** 구성원 한 명의 캐릭터 외형. 역할·성별과 무관하게 자유롭게 조합한다. */
export type CharacterConfig = {
  skin: SkinId
  hair: HairId
  outfit: OutfitId
  accessory: AccessoryId
}

export const DEFAULT_CHARACTER: CharacterConfig = { skin: "skin2", hair: "bob_brown", outfit: "sweater", accessory: "none" }

/** 원본 SVG viewBox(20×28). 화면 크기는 이 비율로 계산한다. */
export const CHARACTER_BOX = { width: 20, height: 28 } as const

const BASE = "/assets/pixel/characters"
const FACE_FILE = "face_smile"

function find<T extends { id: string }>(list: readonly T[], id: string): T | undefined {
  return list.find((o) => o.id === id)
}

export function isValidCharacter(value: unknown): value is CharacterConfig {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return (
    typeof v.skin === "string" && !!find(SKIN_OPTIONS, v.skin) &&
    typeof v.hair === "string" && !!find(HAIR_OPTIONS, v.hair) &&
    typeof v.outfit === "string" && !!find(OUTFIT_OPTIONS, v.outfit) &&
    typeof v.accessory === "string" && !!find(ACCESSORY_OPTIONS, v.accessory)
  )
}

/** 아래→위 순서의 레이어 경로. 몸(피부) 위에 의상이 아니라, 원본과 같이 의상 → 몸 → 얼굴 → 머리 → 소품 순서다. */
export function characterLayers(config: CharacterConfig): { key: string; src: string }[] {
  const skin = find(SKIN_OPTIONS, config.skin) ?? SKIN_OPTIONS[1]
  const hair = find(HAIR_OPTIONS, config.hair) ?? HAIR_OPTIONS[0]
  const outfit = find(OUTFIT_OPTIONS, config.outfit) ?? OUTFIT_OPTIONS[0]
  const accessory = find(ACCESSORY_OPTIONS, config.accessory) ?? ACCESSORY_OPTIONS[0]
  const layers = [
    { key: "outfit", src: `${BASE}/outfit/${outfit.file}.svg` },
    { key: "body", src: `${BASE}/body/${skin.file}.svg` },
    { key: "face", src: `${BASE}/face/${FACE_FILE}.svg` },
    { key: "hair", src: `${BASE}/hair/${hair.file}.svg` },
  ]
  if (accessory.file) layers.push({ key: "accessory", src: `${BASE}/accessory/${accessory.file}.svg` })
  return layers
}

/** 사람이 읽는 외형 설명(접근성 이름 보조용) */
export function describeCharacter(config: CharacterConfig) {
  const parts = [
    find(HAIR_OPTIONS, config.hair)?.label,
    find(OUTFIT_OPTIONS, config.outfit)?.label,
    config.accessory !== "none" ? find(ACCESSORY_OPTIONS, config.accessory)?.label : null,
  ].filter(Boolean)
  return parts.join(", ")
}
