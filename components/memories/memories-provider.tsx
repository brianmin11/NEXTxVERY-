"use client"

import * as React from "react"

import { useDemoViewer } from "@/components/demo/demo-viewer-provider"
import { todayKey } from "@/lib/calendar/date"
import type { DateKey } from "@/lib/calendar/types"
import { seedMemories } from "@/lib/memories/fixture"
import { revokeIfBlob } from "@/lib/memories/image"
import type { MemoryAsset, MemoryDraft, MemoryPost } from "@/lib/memories/types"

/**
 * 추억 사진 데모 상태. 사진은 File/Blob + object URL로만 다루고
 * localStorage·IndexedDB·base64·서버 전송은 하지 않는다. 이 브라우저 탭 안에서만 보이고 새로고침하면 사라진다.
 * object URL 해제는 reducer 밖(이벤트 핸들러)에서 한다: 교체·취소된 임시 사진, 삭제된 게시물만 해제하고,
 * 등록된 사진은 화면이 언마운트돼도 해제하지 않는다.
 */

type State = {
  posts: MemoryPost[]
  assets: Record<string, MemoryAsset>
  draft: MemoryDraft
  usedTokens: string[]
}

type Action =
  | { type: "draft/update"; viewerId: string; patch: Partial<Pick<MemoryDraft, "memoryDate" | "caption">> }
  | { type: "draft/setPending"; viewerId: string; asset: MemoryAsset }
  | { type: "draft/clearPending"; viewerId: string }
  | { type: "draft/reset"; viewerId: string; today: DateKey }
  | { type: "post/add"; viewerId: string; post: MemoryPost; token: string }
  | { type: "post/remove"; id: string }

function emptyDraft(ownerId: string | null, today: DateKey): MemoryDraft {
  return { ownerId, memoryDate: today, caption: "", pendingAssetId: null, step: "compose", submitToken: null, createdPostId: null }
}

function ownDraft(state: State, viewerId: string, today: DateKey) {
  return state.draft.ownerId === viewerId ? state.draft : emptyDraft(viewerId, today)
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "draft/update": {
      const draft = ownDraft(state, action.viewerId, state.draft.memoryDate)
      if (draft.step === "done") return state
      return { ...state, draft: { ...draft, ...action.patch } }
    }
    case "draft/setPending": {
      const draft = ownDraft(state, action.viewerId, state.draft.memoryDate)
      const assets = { ...state.assets, [action.asset.id]: action.asset }
      // 이전 임시 자산은 호출한 쪽이 이미 revoke 했다. 목록에서만 뺀다.
      if (draft.pendingAssetId && draft.pendingAssetId !== action.asset.id) delete assets[draft.pendingAssetId]
      return { ...state, assets, draft: { ...draft, pendingAssetId: action.asset.id, step: "compose", submitToken: crypto.randomUUID() } }
    }
    case "draft/clearPending": {
      const draft = ownDraft(state, action.viewerId, state.draft.memoryDate)
      if (!draft.pendingAssetId) return state
      const assets = { ...state.assets }
      delete assets[draft.pendingAssetId]
      return { ...state, assets, draft: { ...draft, pendingAssetId: null, submitToken: null } }
    }
    case "draft/reset": {
      const assets = { ...state.assets }
      if (state.draft.ownerId === action.viewerId && state.draft.pendingAssetId && state.draft.step === "compose") {
        delete assets[state.draft.pendingAssetId]
      }
      return { ...state, assets, draft: emptyDraft(action.viewerId, action.today) }
    }
    case "post/add": {
      const draft = ownDraft(state, action.viewerId, state.draft.memoryDate)
      if (draft.step === "done" || !draft.pendingAssetId || draft.submitToken !== action.token) return state
      if (state.usedTokens.includes(action.token) || state.posts.some((p) => p.id === action.post.id)) return state
      // 임시 자산이 등록된 자산이 된다. URL은 해제하지 않는다.
      return {
        ...state,
        posts: [...state.posts, action.post],
        usedTokens: [...state.usedTokens, action.token],
        draft: { ...draft, step: "done", createdPostId: action.post.id },
      }
    }
    case "post/remove": {
      const post = state.posts.find((p) => p.id === action.id)
      if (!post) return state
      const assets = { ...state.assets }
      delete assets[post.assetId]
      return { ...state, assets, posts: state.posts.filter((p) => p.id !== action.id) }
    }
  }
}

function byMemoryDateDesc(a: MemoryPost, b: MemoryPost) {
  if (a.memoryDate !== b.memoryDate) return a.memoryDate < b.memoryDate ? 1 : -1
  return a.createdAt < b.createdAt ? 1 : -1
}
function byCreatedDesc(a: MemoryPost, b: MemoryPost) {
  return a.createdAt < b.createdAt ? 1 : -1
}

type MemoriesContextValue = {
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
  /** 검사에 성공한 자산을 임시로 둔다. 이전 임시 blob은 해제한다 */
  setPendingAsset: (asset: MemoryAsset) => void
  clearPendingAsset: () => void
  resetDraft: () => void
  /** 등록. 같은 토큰으로는 한 번만 */
  addPost: (fields: Pick<MemoryPost, "memoryDate" | "caption">, token: string) => string | null
  removePost: (id: string) => void
}

const MemoriesContext = React.createContext<MemoriesContextValue | null>(null)

export function MemoriesProvider({ children, seeded = true }: { children: React.ReactNode; seeded?: boolean }) {
  const { family, viewerId } = useDemoViewer()
  const [state, dispatch] = React.useReducer(reducer, null, () => {
    const today = todayKey()
    const seed = seeded ? seedMemories(today, family.members.map((m) => m.id)) : { posts: [], assets: [] }
    const assets: Record<string, MemoryAsset> = {}
    for (const a of seed.assets) assets[a.id] = a
    return { posts: seed.posts, assets, draft: emptyDraft(null, today), usedTokens: [] }
  })
  // 가족 전환으로 이 provider가 사라질 때 임시 blob URL을 모두 해제한다(등록된 사진 포함). 화면 이동으로는 사라지지 않는다.
  const assetsRef = React.useRef(state.assets)
  React.useEffect(() => {
    assetsRef.current = state.assets
  })
  React.useEffect(
    () => () => {
      for (const a of Object.values(assetsRef.current)) if (a.kind === "blob") revokeIfBlob(a.objectUrl)
    },
    []
  )
  const today = todayKey()
  const draft = ownDraft(state, viewerId, today)
  const pendingAsset = draft.pendingAssetId ? state.assets[draft.pendingAssetId] : undefined
  const draftDirty = draft.step === "compose" && (draft.pendingAssetId !== null || draft.caption.trim() !== "")

  const value: MemoriesContextValue = {
    posts: state.posts,
    sortedPosts: [...state.posts].sort(byMemoryDateDesc),
    recentPosts: [...state.posts].sort(byCreatedDesc),
    assetById: (id) => state.assets[id],
    postById: (id) => state.posts.find((p) => p.id === id),
    draft,
    pendingAsset,
    draftDirty,
    updateDraft: (patch) => dispatch({ type: "draft/update", viewerId, patch }),
    setPendingAsset: (asset) => {
      if (pendingAsset?.kind === "blob" && pendingAsset.id !== asset.id) revokeIfBlob(pendingAsset.objectUrl)
      dispatch({ type: "draft/setPending", viewerId, asset })
    },
    clearPendingAsset: () => {
      if (pendingAsset?.kind === "blob") revokeIfBlob(pendingAsset.objectUrl)
      dispatch({ type: "draft/clearPending", viewerId })
    },
    resetDraft: () => {
      if (draft.step === "compose" && pendingAsset?.kind === "blob") revokeIfBlob(pendingAsset.objectUrl)
      dispatch({ type: "draft/reset", viewerId, today })
    },
    addPost: (fields, token) => {
      if (!draft.pendingAssetId || draft.submitToken !== token || draft.step === "done") return null
      const id = crypto.randomUUID()
      dispatch({
        type: "post/add",
        viewerId,
        token,
        post: { id, authorId: viewerId, memoryDate: fields.memoryDate, caption: fields.caption.trim(), createdAt: new Date().toISOString(), assetId: draft.pendingAssetId },
      })
      return id
    },
    removePost: (id) => {
      const post = state.posts.find((p) => p.id === id)
      const asset = post ? state.assets[post.assetId] : undefined
      if (asset?.kind === "blob") revokeIfBlob(asset.objectUrl)
      dispatch({ type: "post/remove", id })
    },
  }
  return <MemoriesContext.Provider value={value}>{children}</MemoriesContext.Provider>
}

export function useMemories() {
  const ctx = React.useContext(MemoriesContext)
  if (!ctx) throw new Error("useMemories는 MemoriesProvider 안에서만 쓸 수 있어요.")
  return ctx
}
