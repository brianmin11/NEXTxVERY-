import { addDays } from "@/lib/calendar/date"
import type { DateKey } from "@/lib/calendar/types"

import type { MemoryAsset, MemoryPost } from "./types"

/**
 * 가상 추억 seed. 프로젝트에 사진 자산이 없어 로컬 합성 플레이스홀더('예시 이미지')를 쓴다.
 * 외부 가족 사진을 가져오지 않는다. 한 번만 만든다.
 */
export function seedMemories(today: DateKey, memberIds: string[]) {
  const [first, second] = memberIds
  const d1 = addDays(today, -7)
  const d2 = addDays(today, -20)
  const assets: MemoryAsset[] = [
    { id: "seed-asset-picnic", kind: "placeholder", label: "예시 이미지 · 가을 소풍", width: 4, height: 3, tone: "apricot" },
    { id: "seed-asset-pancake", kind: "placeholder", label: "예시 이미지 · 팬케이크", width: 3, height: 4, tone: "butter" },
  ]
  const posts: MemoryPost[] = [
    {
      id: "seed-picnic",
      authorId: second ?? first,
      memoryDate: d1,
      caption: "가을 소풍에서 다 같이 찍은 사진. 바람이 좋았어요.",
      createdAt: `${d1}T14:30:00+09:00`,
      assetId: "seed-asset-picnic",
      seed: true,
    },
    {
      id: "seed-pancake",
      authorId: first,
      memoryDate: d2,
      caption: "주말 아침 팬케이크 만들기",
      createdAt: `${d2}T09:10:00+09:00`,
      assetId: "seed-asset-pancake",
      seed: true,
    },
  ]
  return { assets, posts }
}
