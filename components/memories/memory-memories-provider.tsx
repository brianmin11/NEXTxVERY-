"use client"

import * as React from "react"

import { useFamily } from "@/components/family/family-context"
import { todayKey } from "@/lib/calendar/date"
import type { DateKey } from "@/lib/calendar/types"
import { seedMemories } from "@/lib/memories/fixture"
import { revokeIfBlob } from "@/lib/memories/image"
import type { MemoryAsset, MemoryDraft, MemoryPost } from "@/lib/memories/types"

import { byCreatedDesc, byMemoryDateDesc, emptyMemoryDraft, MemoriesContext, type MemoriesContextValue } from "./memories-context"

/**
 * 추억 사진 데모 상태(메모리). 사진은 File/Blob + object URL로만 다루고
 * localStorage·IndexedDB·base64·서버 전송은 하지 않는다. 이 브라우저 탭 안에서만 보이고 새로고침하면 사라진다.
 * object URL 해제는 reducer 밖(이벤트 핸들러)에서 한다: 교체·취소된 임시 사진, 삭제된 게시물만 해제하고,
 * 등록된 사진은 화면이 언마운트돼도 해제하지 않는다(가족 전환으로 provider가 사라질 때만 모두 해제).
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

function ownDraft(state: State, viewerId: string, today: DateKey) {
  return state.draft.ownerId === viewerId ? state.draft : emptyMemoryDraft(viewerId, today)
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
      return { ...state, assets, draft: emptyMemoryDraft(action.viewerId, action.today) }
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

export function MemoryMemoriesProvider({ children, seeded = true }: { children: React.ReactNode; seeded?: boolean }) {
  const { family, viewerId } = useFamily()
  const [state, dispatch] = React.useReducer(reducer, null, () => {
    const today = todayKey()
    const seed = seeded ? seedMemories(today, family.members.map((m) => m.id)) : { posts: [], assets: [] }
    const assets: Record<string, MemoryAsset> = {}
    for (const a of seed.assets) assets[a.id] = a
    return { posts: seed.posts, assets, draft: emptyMemoryDraft(null, today), usedTokens: [] }
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
    uploading: false,
    updateDraft: (patch) => dispatch({ type: "draft/update", viewerId, patch }),
    setPendingAsset: (asset) => {
      if (pendingAsset?.kind === "blob" && pendingAsset.id !== asset.id) revokeIfBlob(pendingAsset.objectUrl)
      dispatch({ type: "draft/setPending", viewerId, asset })
    },
    // 데모에서는 업로드가 없다. 검사한 blob 자산을 그대로 둔다.
    upload: async () => "데모에서는 사진을 서버에 올리지 않아요.",
    clearPendingAsset: () => {
      if (pendingAsset?.kind === "blob") revokeIfBlob(pendingAsset.objectUrl)
      dispatch({ type: "draft/clearPending", viewerId })
    },
    resetDraft: () => {
      if (draft.step === "compose" && pendingAsset?.kind === "blob") revokeIfBlob(pendingAsset.objectUrl)
      dispatch({ type: "draft/reset", viewerId, today })
    },
    addPost: async (fields, token) => {
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
    removePost: async (id) => {
      const post = state.posts.find((p) => p.id === id)
      const asset = post ? state.assets[post.assetId] : undefined
      if (asset?.kind === "blob") revokeIfBlob(asset.objectUrl)
      dispatch({ type: "post/remove", id })
      return true
    },
    loading: false,
    error: null,
    refresh: async () => true,
  }
  return <MemoriesContext.Provider value={value}>{children}</MemoriesContext.Provider>
}
