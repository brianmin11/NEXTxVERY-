"use client"

import * as React from "react"

import type { DateKey } from "@/lib/calendar/types"
import type { MemoryAsset, MemoryDraft, MemoryPost } from "@/lib/memories/types"

/** 추억 사진 상태의 공통 모양. 데모(메모리 object URL)와 라이브(서버 업로드) provider가 같은 인터페이스를 제공한다. */
export type MemoriesContextValue = {
  posts: MemoryPost[]
  /** 추억 날짜 내림차순, 같은 날짜는 등록 시각 내림차순 */
  sortedPosts: MemoryPost[]
  /** 등록 시각 내림차순(홈용) */
  recentPosts: MemoryPost[]
  assetById: (id: string) => MemoryAsset | undefined
  postById: (id: string) => MemoryPost | undefined
  draft: MemoryDraft
  pendingAsset: MemoryAsset | undefined
  draftDirty: boolean
  updateDraft: (patch: Partial<Pick<MemoryDraft, "memoryDate" | "caption">>) => void
  /** 검사에 성공한 임시 자산을 둔다(데모: blob). 라이브에서는 `upload`가 대신 호출된다 */
  setPendingAsset: (asset: MemoryAsset) => void
  /** 라이브: 서버 업로드(재인코딩·검증) 뒤 pending 자산으로 둔다. 성공하면 null, 실패하면 오류 문구 */
  upload: (file: File) => Promise<string | null>
  uploading: boolean
  clearPendingAsset: () => void
  resetDraft: () => void
  /** 등록. 같은 토큰으로는 한 번만. 성공하면 게시물 id */
  addPost: (fields: Pick<MemoryPost, "memoryDate" | "caption">, token: string) => Promise<string | null>
  removePost: (id: string) => Promise<boolean>
  loading: boolean
  error: string | null
  refresh: () => Promise<boolean>
}

export const MemoriesContext = React.createContext<MemoriesContextValue | null>(null)

export function useMemories() {
  const ctx = React.useContext(MemoriesContext)
  if (!ctx) throw new Error("useMemories는 MemoriesProvider 안에서만 쓸 수 있어요.")
  return ctx
}

export function emptyMemoryDraft(ownerId: string | null, today: DateKey): MemoryDraft {
  return { ownerId, memoryDate: today, caption: "", pendingAssetId: null, step: "compose", submitToken: null, createdPostId: null }
}

export function byMemoryDateDesc(a: MemoryPost, b: MemoryPost) {
  if (a.memoryDate !== b.memoryDate) return a.memoryDate < b.memoryDate ? 1 : -1
  return a.createdAt < b.createdAt ? 1 : -1
}
export function byCreatedDesc(a: MemoryPost, b: MemoryPost) {
  return a.createdAt < b.createdAt ? 1 : -1
}
