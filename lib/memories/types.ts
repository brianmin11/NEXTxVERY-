import type { DateKey } from "@/lib/calendar/types"

/**
 * 사진 자산. 게시물과 분리해 관리한다.
 * blob 자산의 objectUrl은 이 브라우저 탭 안에서만 유효한 임시 주소이며
 * 미래 서버 데이터의 영구 식별자가 아니다(서버 연결 시 asset id ↔ 저장 경로로 교체).
 */
export type MemoryAsset =
  | {
      id: string
      kind: "blob"
      objectUrl: string
      mime: string
      width: number
      height: number
      bytes: number
    }
  | {
      id: string
      kind: "placeholder"
      /** 합성 예시 이미지 라벨 */
      label: string
      width: number
      height: number
      tone: "apricot" | "sky" | "butter"
    }

export type MemoryPost = {
  id: string
  authorId: string
  /** 추억 날짜 YYYY-MM-DD */
  memoryDate: DateKey
  caption: string
  /** ISO 8601 등록 시각 */
  createdAt: string
  assetId: string
  /** 가상 예시 데이터 표시용 */
  seed?: boolean
}

/** 작성 중 상태. 작성한 인물에게만 보이고 메모리에만 있다. */
export type MemoryDraft = {
  ownerId: string | null
  memoryDate: DateKey
  caption: string
  pendingAssetId: string | null
  step: "compose" | "done"
  /** 등록 버튼 연타 방지 토큰 */
  submitToken: string | null
  createdPostId: string | null
}

export type ImageInspectResult =
  | { ok: true; objectUrl: string; mime: string; width: number; height: number; bytes: number }
  | { ok: false; reason: "unsupported" | "too-large" | "corrupted"; message: string }
