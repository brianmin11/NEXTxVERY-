"use client"

import * as React from "react"

import { useFamily } from "@/components/family/family-context"
import { byCreatedDesc, byMemoryDateDesc, emptyMemoryDraft, MemoriesContext, type MemoriesContextValue } from "@/components/memories/memories-context"
import { todayKey } from "@/lib/calendar/date"
import { revokeIfBlob } from "@/lib/memories/image"
import type { MemoryAsset, MemoryPost } from "@/lib/memories/types"

import { api, ResourceState, useResource } from "./client"

/**
 * 라이브 추억 provider: `GET/POST /api/v2/memories`, `DELETE /api/v2/memories/:id`,
 * 업로드 `POST /api/v2/memories/assets`(서버가 형식·용량·실제 내용 검사 후 WebP 재인코딩, 24시간 안에 게시물에 연결되지 않으면 정리).
 * 사진 조회 URL은 로그인·가족 권한을 검사하는 `/api/v2/memories/assets/:id/content`뿐이다.
 */
export function LiveMemoriesProvider({ children }: { children: React.ReactNode }) {
  const { viewerId } = useFamily()
  const r = useResource<{ posts: MemoryPost[]; assets: MemoryAsset[] }>("memories", { posts: [], assets: [] })
  const [draft, setDraft] = React.useState(() => emptyMemoryDraft(viewerId, todayKey()))
  const [pendingAsset, setPending] = React.useState<MemoryAsset>()
  const [uploading, setUploading] = React.useState(false)
  const [uploadError, setUploadError] = React.useState<string | null>(null)
  // 빠르게 다른 사진을 고르면 이전 업로드 결과를 버린다.
  const uploadVersion = React.useRef(0)
  const posts = r.data.posts

  const value: MemoriesContextValue = {
    posts,
    sortedPosts: [...posts].sort(byMemoryDateDesc),
    recentPosts: [...posts].sort(byCreatedDesc),
    assetById: (id) => (pendingAsset?.id === id ? pendingAsset : r.data.assets.find((a) => a.id === id)),
    postById: (id) => posts.find((p) => p.id === id),
    draft,
    pendingAsset,
    draftDirty: draft.step === "compose" && (!!pendingAsset || draft.caption.trim() !== ""),
    uploading,
    updateDraft: (patch) => setDraft((d) => (d.step === "done" ? d : { ...d, ...patch })),
    // 라이브에서는 미리보기용 blob을 잠깐 보여 주고, 실제 자산은 upload 결과(remote)로 바뀐다.
    setPendingAsset: (asset) => {
      setPending((prev) => {
        if (prev?.kind === "blob" && prev.id !== asset.id) revokeIfBlob(prev.objectUrl)
        return asset
      })
      setDraft((d) => ({ ...d, pendingAssetId: asset.id, step: "compose", submitToken: null }))
    },
    upload: async (file) => {
      const v = ++uploadVersion.current
      setUploading(true)
      setUploadError(null)
      try {
        const form = new FormData()
        form.append("file", file)
        const asset = await api<MemoryAsset>("memories/assets", "POST", form)
        if (v !== uploadVersion.current) return "다른 사진을 골라 이전 업로드는 버렸어요."
        setPending((prev) => {
          if (prev?.kind === "blob") revokeIfBlob(prev.objectUrl)
          return asset
        })
        setDraft((d) => ({ ...d, pendingAssetId: asset.id, step: "compose", submitToken: crypto.randomUUID() }))
        return null
      } catch (e) {
        const message = e instanceof Error ? e.message : "사진을 올리지 못했어요. 다시 시도해 주세요."
        if (v === uploadVersion.current) setUploadError(message)
        return message
      } finally {
        if (v === uploadVersion.current) setUploading(false)
      }
    },
    clearPendingAsset: () => {
      uploadVersion.current++
      setUploading(false)
      setUploadError(null)
      setPending((prev) => {
        if (prev?.kind === "blob") revokeIfBlob(prev.objectUrl)
        return undefined
      })
      setDraft((d) => ({ ...d, pendingAssetId: null, submitToken: null }))
    },
    resetDraft: () => {
      uploadVersion.current++
      setUploading(false)
      setUploadError(null)
      setPending((prev) => {
        if (prev?.kind === "blob") revokeIfBlob(prev.objectUrl)
        return undefined
      })
      setDraft(emptyMemoryDraft(viewerId, todayKey()))
    },
    addPost: async (fields, token) => {
      if (!pendingAsset || pendingAsset.kind !== "remote" || draft.submitToken !== token || draft.step === "done") return null
      const p = await r.mutate<MemoryPost>("memories", "POST", { fields: { ...fields, caption: fields.caption.trim(), assetId: pendingAsset.id } }, token)
      if (!p) return null
      setDraft((d) => ({ ...d, step: "done", createdPostId: p.id }))
      return p.id
    },
    removePost: async (id) => !!(await r.mutate(`memories/${id}`, "DELETE", { expectedRevision: posts.find((p) => p.id === id)?.revision })),
    loading: r.loading,
    error: uploadError ?? (r.error || null),
    refresh: r.refresh,
  }
  return (
    <MemoriesContext.Provider value={value}>
      <ResourceState loading={r.loading} error={r.error} busy={r.busy} retry={r.refresh}>
        {children}
      </ResourceState>
    </MemoriesContext.Provider>
  )
}
