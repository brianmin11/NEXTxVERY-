"use client"

import * as React from "react"

import { useDemoViewer } from "@/components/demo/demo-viewer-provider"
import { todayKey } from "@/lib/calendar/date"
import { seedChores } from "@/lib/chores/fixture"
import { canDeleteChore, canEditChore, canToggleChore } from "@/lib/chores/permissions"
import type { Chore, ChoreDraft, ChoreNewDraft, ChoreStatus } from "@/lib/chores/types"

/**
 * 집안일 데모 상태. 메모리에만 있어 라우트 이동 중 유지되고 새로고침하면 초기화된다.
 * 권한 규칙(lib/chores/permissions)은 UI와 여기 변경 함수가 같이 쓴다. 서버 보호가 아니다.
 * 실제 저장·알림·동기화는 없다.
 */

type State = {
  chores: Chore[]
  draft: ChoreNewDraft
  usedTokens: string[]
}

type Action =
  | { type: "draft/update"; viewerId: string; patch: Partial<ChoreDraft> }
  | { type: "draft/reset"; viewerId: string }
  | { type: "chore/add"; viewerId: string; chore: Chore; token: string }
  | { type: "chore/update"; viewerId: string; id: string; fields: Pick<Chore, "title" | "memo" | "assigneeMemberId" | "dueDate">; at: string }
  | { type: "chore/status"; viewerId: string; id: string; status: ChoreStatus; at: string }
  | { type: "chore/remove"; viewerId: string; id: string }

function emptyDraft(ownerId: string | null, assignee: string): ChoreNewDraft {
  return { ownerId, title: "", memo: "", assigneeMemberId: assignee, dueDate: "", step: "compose", submitToken: crypto.randomUUID(), createdId: null }
}

function ownDraft(state: State, viewerId: string) {
  return state.draft.ownerId === viewerId ? state.draft : emptyDraft(viewerId, viewerId)
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "draft/update": {
      const draft = ownDraft(state, action.viewerId)
      if (draft.step === "done") return state
      return { ...state, draft: { ...draft, ...action.patch } }
    }
    case "draft/reset":
      return { ...state, draft: emptyDraft(action.viewerId, action.viewerId) }
    case "chore/add": {
      const draft = ownDraft(state, action.viewerId)
      if (draft.step === "done" || draft.submitToken !== action.token) return state
      if (state.usedTokens.includes(action.token) || state.chores.some((c) => c.id === action.chore.id)) return state
      return {
        ...state,
        chores: [...state.chores, action.chore],
        usedTokens: [...state.usedTokens, action.token],
        draft: { ...draft, step: "done", createdId: action.chore.id },
      }
    }
    case "chore/update":
      return {
        ...state,
        chores: state.chores.map((c) =>
          c.id === action.id && canEditChore(c, action.viewerId) ? { ...c, ...action.fields, updatedAt: action.at, seed: undefined } : c
        ),
      }
    case "chore/status":
      return {
        ...state,
        chores: state.chores.map((c) => {
          if (c.id !== action.id || !canToggleChore(c, action.viewerId) || c.status === action.status) return c
          return action.status === "done"
            ? { ...c, status: "done", completedAt: action.at, completedByMemberId: action.viewerId, updatedAt: action.at, seed: undefined }
            : { ...c, status: "todo", completedAt: null, completedByMemberId: null, updatedAt: action.at, seed: undefined }
        }),
      }
    case "chore/remove":
      return { ...state, chores: state.chores.filter((c) => !(c.id === action.id && canDeleteChore(c, action.viewerId))) }
  }
}

/** 미완료: 날짜 오름차순(미정은 뒤) → 만든 순 */
export function sortTodos(chores: Chore[]) {
  return [...chores].sort((a, b) => {
    if (a.dueDate !== b.dueDate) {
      if (a.dueDate === null) return 1
      if (b.dueDate === null) return -1
      return a.dueDate < b.dueDate ? -1 : 1
    }
    return a.createdAt < b.createdAt ? -1 : 1
  })
}
/** 완료: 완료 시각 내림차순 */
export function sortDones(chores: Chore[]) {
  return [...chores].sort((a, b) => ((a.completedAt ?? "") < (b.completedAt ?? "") ? 1 : -1))
}

type ChoresContextValue = {
  today: string
  chores: Chore[]
  choreById: (id: string) => Chore | undefined
  /** 상태별 정렬된 목록. mine이면 현재 인물이 담당자인 것만 */
  listChores: (status: ChoreStatus, mine: boolean) => Chore[]
  draft: ChoreNewDraft
  draftDirty: boolean
  updateDraft: (patch: Partial<ChoreDraft>) => void
  resetDraft: () => void
  addChore: (fields: Pick<Chore, "title" | "memo" | "assigneeMemberId" | "dueDate">, token: string) => string | null
  updateChore: (id: string, fields: Pick<Chore, "title" | "memo" | "assigneeMemberId" | "dueDate">) => boolean
  /** 목표 상태를 명시한다(토글 아님). 이미 그 상태면 아무 일도 하지 않는다 */
  setStatus: (id: string, status: ChoreStatus) => boolean
  removeChore: (id: string) => boolean
}

const ChoresContext = React.createContext<ChoresContextValue | null>(null)

export function ChoresProvider({ children }: { children: React.ReactNode }) {
  const { family, viewerId } = useDemoViewer()
  const [state, dispatch] = React.useReducer(reducer, null, () => ({
    chores: seedChores(todayKey(), family.members.map((m) => m.id)),
    draft: emptyDraft(null, family.members[0].id),
    usedTokens: [],
  }))
  const today = todayKey()
  const draft = ownDraft(state, viewerId)
  const draftDirty = draft.step === "compose" && (draft.title.trim() !== "" || draft.memo.trim() !== "" || draft.dueDate !== "" || draft.assigneeMemberId !== viewerId)

  const value: ChoresContextValue = {
    today,
    chores: state.chores,
    choreById: (id) => state.chores.find((c) => c.id === id),
    listChores: (status, mine) => {
      const filtered = state.chores.filter((c) => c.status === status && (!mine || c.assigneeMemberId === viewerId))
      return status === "todo" ? sortTodos(filtered) : sortDones(filtered)
    },
    draft,
    draftDirty,
    updateDraft: (patch) => dispatch({ type: "draft/update", viewerId, patch }),
    resetDraft: () => dispatch({ type: "draft/reset", viewerId }),
    addChore: (fields, token) => {
      if (draft.step === "done" || draft.submitToken !== token) return null
      const now = new Date().toISOString()
      const id = crypto.randomUUID()
      dispatch({
        type: "chore/add",
        viewerId,
        token,
        chore: { id, ...fields, status: "todo", createdByMemberId: viewerId, createdAt: now, updatedAt: now, completedAt: null, completedByMemberId: null },
      })
      return id
    },
    updateChore: (id, fields) => {
      const c = state.chores.find((x) => x.id === id)
      if (!c || !canEditChore(c, viewerId)) return false
      dispatch({ type: "chore/update", viewerId, id, fields, at: new Date().toISOString() })
      return true
    },
    setStatus: (id, status) => {
      const c = state.chores.find((x) => x.id === id)
      if (!c || !canToggleChore(c, viewerId) || c.status === status) return false
      dispatch({ type: "chore/status", viewerId, id, status, at: new Date().toISOString() })
      return true
    },
    removeChore: (id) => {
      const c = state.chores.find((x) => x.id === id)
      if (!c || !canDeleteChore(c, viewerId)) return false
      dispatch({ type: "chore/remove", viewerId, id })
      return true
    },
  }
  return <ChoresContext.Provider value={value}>{children}</ChoresContext.Provider>
}

export function useChores() {
  const ctx = React.useContext(ChoresContext)
  if (!ctx) throw new Error("useChores는 ChoresProvider 안에서만 쓸 수 있어요.")
  return ctx
}
