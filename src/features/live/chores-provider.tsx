"use client"
import * as React from "react"
import { todayKey } from "@/lib/calendar/date"
import type {
  Chore,
  ChoreDraft,
  ChoreNewDraft,
  ChoreStatus,
} from "@/lib/chores/types"
import { useDemoViewer } from "./session"
import { useResource, ResourceState } from "./client"
export function sortTodos(cs: Chore[]) {
  return [...cs].sort(
    (a, b) =>
      (a.dueDate || "9999").localeCompare(b.dueDate || "9999") ||
      a.createdAt.localeCompare(b.createdAt)
  )
}
export function sortDones(cs: Chore[]) {
  return [...cs].sort((a, b) =>
    (b.completedAt || "").localeCompare(a.completedAt || "")
  )
}
type Fields = Pick<Chore, "title" | "memo" | "assigneeMemberId" | "dueDate">
function useValue() {
  const { viewerId } = useDemoViewer()
  const r = useResource<Chore[]>("chores", [])
  const empty = (): ChoreNewDraft => ({
    ownerId: viewerId,
    title: "",
    memo: "",
    assigneeMemberId: viewerId,
    dueDate: "",
    step: "compose",
    submitToken: crypto.randomUUID(),
    createdId: null,
  })
  const [draft, setDraft] = React.useState(empty)
  return {
    ...r,
    today: todayKey(),
    chores: r.data,
    choreById: (id: string) => r.data.find((c) => c.id === id),
    listChores: (status: ChoreStatus, mine: boolean) =>
      (status === "todo" ? sortTodos : sortDones)(
        r.data.filter(
          (c) =>
            c.status === status && (!mine || c.assigneeMemberId === viewerId)
        )
      ),
    draft,
    draftDirty:
      draft.step === "compose" &&
      !!(draft.title || draft.memo || draft.dueDate),
    updateDraft: (patch: Partial<ChoreDraft>) =>
      setDraft((d) => ({ ...d, ...patch, submitToken: crypto.randomUUID() })),
    resetDraft: () => setDraft(empty()),
    addChore: async (fields: Fields, token: string) => {
      const c = await r.mutate<Chore>("chores", "POST", { fields }, token)
      if (c) setDraft((d) => ({ ...d, step: "done", createdId: c.id }))
      return c?.id ?? null
    },
    updateChore: async (id: string, fields: Fields) =>
      !!(await r.mutate("chores/" + id, "PATCH", {
        fields,
        expectedRevision: r.data.find((c) => c.id === id)?.revision,
      })),
    setStatus: async (id: string, status: ChoreStatus) =>
      !!(await r.mutate("chores/" + id + "/status", "PUT", {
        status,
        expectedRevision: r.data.find((c) => c.id === id)?.revision,
      })),
    removeChore: async (id: string) =>
      !!(await r.mutate("chores/" + id, "DELETE", {
        expectedRevision: r.data.find((c) => c.id === id)?.revision,
      })),
  }
}
const Context = React.createContext<ReturnType<typeof useValue> | null>(null)
export function ChoresProvider({ children }: { children: React.ReactNode }) {
  const v = useValue()
  return (
    <Context.Provider value={v}>
      <ResourceState {...v} retry={v.refresh}>
        {children}
      </ResourceState>
    </Context.Provider>
  )
}
export function useChores() {
  const v = React.useContext(Context)
  if (!v) throw new Error("ChoresProvider 필요")
  return v
}
