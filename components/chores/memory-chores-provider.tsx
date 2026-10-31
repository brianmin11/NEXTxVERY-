"use client"

import * as React from "react"

import { useFamily } from "@/components/family/family-context"
import { todayKey } from "@/lib/calendar/date"
import { seedChores } from "@/lib/chores/fixture"
import { canDeleteChore, canEditChore, canToggleChore } from "@/lib/chores/permissions"
import type { Chore, ChoreDraft, ChoreNewDraft, ChoreStatus } from "@/lib/chores/types"

import { ChoresContext, emptyChoreDraft, sortDones, sortTodos, type ChoresContextValue } from "./chores-context"

/**
 * 집안일 데모 상태(메모리). 권한 규칙(lib/chores/permissions)은 UI와 여기 변경 함수가 같이 쓴다.
 * 서버 보호가 아니며 새로고침하면 초기화된다.
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

function ownDraft(state: State, viewerId: string) {
  return state.draft.ownerId === viewerId ? state.draft : emptyChoreDraft(viewerId, viewerId)
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "draft/update": {
      const draft = ownDraft(state, action.viewerId)
      if (draft.step === "done") return state
      return { ...state, draft: { ...draft, ...action.patch } }
    }
    case "draft/reset":
      return { ...state, draft: emptyChoreDraft(action.viewerId, action.viewerId) }
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

export function MemoryChoresProvider({ children, seeded = true }: { children: React.ReactNode; seeded?: boolean }) {
  const { family, viewerId } = useFamily()
  const [state, dispatch] = React.useReducer(reducer, null, () => ({
    chores: seeded ? seedChores(todayKey(), family.members.map((m) => m.id)) : [],
    draft: emptyChoreDraft(null, family.members[0].id),
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
    addChore: async (fields, token) => {
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
    updateChore: async (id, fields) => {
      const c = state.chores.find((x) => x.id === id)
      if (!c || !canEditChore(c, viewerId)) return false
      dispatch({ type: "chore/update", viewerId, id, fields, at: new Date().toISOString() })
      return true
    },
    setStatus: async (id, status) => {
      const c = state.chores.find((x) => x.id === id)
      if (!c || !canToggleChore(c, viewerId) || c.status === status) return false
      dispatch({ type: "chore/status", viewerId, id, status, at: new Date().toISOString() })
      return true
    },
    removeChore: async (id) => {
      const c = state.chores.find((x) => x.id === id)
      if (!c || !canDeleteChore(c, viewerId)) return false
      dispatch({ type: "chore/remove", viewerId, id })
      return true
    },
    loading: false,
    error: null,
    refresh: async () => true,
  }
  return <ChoresContext.Provider value={value}>{children}</ChoresContext.Provider>
}
