"use client"
import * as React from "react"
import { todayKey } from "@/lib/calendar/date"
import type { MemoryAsset, MemoryDraft, MemoryPost } from "@/lib/memories/types"
import { useDemoViewer } from "./session"
import { useResource, ResourceState, api } from "./client"
function useValue() {
  const { viewerId } = useDemoViewer()
  const r = useResource<{ posts: MemoryPost[]; assets: MemoryAsset[] }>(
    "memories",
    { posts: [], assets: [] }
  )
  const empty = (): MemoryDraft => ({
    ownerId: viewerId,
    memoryDate: todayKey(),
    caption: "",
    pendingAssetId: null,
    step: "compose",
    submitToken: null,
    createdPostId: null,
  })
  const [draft, setDraft] = React.useState(empty),
    [pendingAsset, setPending] = React.useState<MemoryAsset>()
  const uploadVersion = React.useRef(0)
  return {
    ...r,
    posts: r.data.posts,
    sortedPosts: [...r.data.posts].sort(
      (a, b) =>
        b.memoryDate.localeCompare(a.memoryDate) ||
        b.createdAt.localeCompare(a.createdAt)
    ),
    recentPosts: [...r.data.posts].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    ),
    assetById: (id: string) =>
      pendingAsset?.id === id
        ? pendingAsset
        : r.data.assets.find((a) => a.id === id),
    postById: (id: string) => r.data.posts.find((p) => p.id === id),
    draft,
    pendingAsset,
    draftDirty: draft.step === "compose" && !!(draft.caption || pendingAsset),
    updateDraft: (
      patch: Partial<Pick<MemoryDraft, "memoryDate" | "caption">>
    ) =>
      setDraft((d) => ({ ...d, ...patch, submitToken: crypto.randomUUID() })),
    setPendingAsset: (asset: MemoryAsset) => {
      setPending(asset)
      setDraft((d) => ({
        ...d,
        pendingAssetId: asset.id,
        submitToken: crypto.randomUUID(),
      }))
    },
    upload: async (file: File) => {
      const v = ++uploadVersion.current
      const form = new FormData()
      form.append("file", file)
      const asset = await api<MemoryAsset>("memories/assets", "POST", form)
      if (v === uploadVersion.current) {
        setPending(asset)
        setDraft((d) => ({
          ...d,
          pendingAssetId: asset.id,
          submitToken: crypto.randomUUID(),
        }))
      }
    },
    clearPendingAsset: () => {
      uploadVersion.current++
      setPending(undefined)
      setDraft((d) => ({ ...d, pendingAssetId: null, submitToken: null }))
    },
    resetDraft: () => {
      uploadVersion.current++
      setPending(undefined)
      setDraft(empty())
    },
    addPost: async (
      fields: Pick<MemoryPost, "memoryDate" | "caption">,
      token: string
    ) => {
      if (!pendingAsset) return null
      const p = await r.mutate<MemoryPost>(
        "memories",
        "POST",
        { fields: { ...fields, assetId: pendingAsset.id } },
        token
      )
      if (p) setDraft((d) => ({ ...d, step: "done", createdPostId: p.id }))
      return p?.id ?? null
    },
    removePost: async (id: string) =>
      !!(await r.mutate("memories/" + id, "DELETE", {
        expectedRevision: r.data.posts.find((p) => p.id === id)?.revision,
      })),
  }
}
const Context = React.createContext<ReturnType<typeof useValue> | null>(null)
export function MemoriesProvider({ children }: { children: React.ReactNode }) {
  const v = useValue()
  return (
    <Context.Provider value={v}>
      <ResourceState {...v} retry={v.refresh}>
        {children}
      </ResourceState>
    </Context.Provider>
  )
}
export function useMemories() {
  const v = React.useContext(Context)
  if (!v) throw new Error("MemoriesProvider 필요")
  return v
}
