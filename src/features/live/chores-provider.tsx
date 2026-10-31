"use client"

import * as React from "react"

import { ChoresContext, emptyChoreDraft, sortDones, sortTodos, type ChoresContextValue } from "@/components/chores/chores-context"
import { useFamily } from "@/components/family/family-context"
import { todayKey } from "@/lib/calendar/date"
import type { Chore } from "@/lib/chores/types"

import { ResourceState, useResource } from "./client"

/**
 * 라이브 집안일 provider: `GET/POST /api/v2/chores`, `PATCH/DELETE /api/v2/chores/:id`, `PUT /api/v2/chores/:id/status`.
 * 완료는 목표 상태를 보내고(토글 아님) 서버가 완료 시각·완료자를 기록한다. 권한(작성자·담당자)은 서버가 검증한다.
 */
export function LiveChoresProvider({ children }: { children: React.ReactNode }) {
  const { viewerId } = useFamily()
  const r = useResource<Chore[]>("chores", [])
  const [draft, setDraft] = React.useState(() => emptyChoreDraft(viewerId, viewerId))
  const chores = r.data

  const value: ChoresContextValue = {
    today: todayKey(),
    chores,
    choreById: (id) => chores.find((c) => c.id === id),
    listChores: (status, mine) => {
      const filtered = chores.filter((c) => c.status === status && (!mine || c.assigneeMemberId === viewerId))
      return status === "todo" ? sortTodos(filtered) : sortDones(filtered)
    },
    draft,
    draftDirty: draft.step === "compose" && (draft.title.trim() !== "" || draft.memo.trim() !== "" || draft.dueDate !== "" || draft.assigneeMemberId !== viewerId),
    updateDraft: (patch) => setDraft((d) => (d.step === "done" ? d : { ...d, ...patch })),
    resetDraft: () => setDraft(emptyChoreDraft(viewerId, viewerId)),
    addChore: async (fields, token) => {
      if (draft.step === "done" || draft.submitToken !== token) return null
      const created = await r.mutate<Chore>("chores", "POST", { fields }, token)
      if (!created) return null
      setDraft((d) => ({ ...d, step: "done", createdId: created.id }))
      return created.id
    },
    updateChore: async (id, fields) =>
      !!(await r.mutate(`chores/${id}`, "PATCH", { fields, expectedRevision: chores.find((c) => c.id === id)?.revision })),
    setStatus: async (id, status) => {
      const c = chores.find((x) => x.id === id)
      if (!c || c.status === status) return false
      return !!(await r.mutate(`chores/${id}/status`, "PUT", { status, expectedRevision: c.revision }))
    },
    removeChore: async (id) => !!(await r.mutate(`chores/${id}`, "DELETE", { expectedRevision: chores.find((c) => c.id === id)?.revision })),
    loading: r.loading,
    error: r.error || null,
    refresh: r.refresh,
  }
  return (
    <ChoresContext.Provider value={value}>
      <ResourceState loading={r.loading} error={r.error} busy={r.busy} retry={r.refresh}>
        {children}
      </ResourceState>
    </ChoresContext.Provider>
  )
}
