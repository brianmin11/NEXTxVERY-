"use client"

import * as React from "react"

import type { Chore, ChoreDraft, ChoreNewDraft, ChoreStatus } from "@/lib/chores/types"

export type ChoreFields = Pick<Chore, "title" | "memo" | "assigneeMemberId" | "dueDate">

/** 집안일 상태의 공통 모양. 데모(메모리)와 라이브(서버) provider가 같은 인터페이스를 제공한다. */
export type ChoresContextValue = {
  today: string
  chores: Chore[]
  choreById: (id: string) => Chore | undefined
  /** 상태별 정렬된 목록. mine이면 현재 인물이 담당자인 것만 */
  listChores: (status: ChoreStatus, mine: boolean) => Chore[]
  draft: ChoreNewDraft
  draftDirty: boolean
  updateDraft: (patch: Partial<ChoreDraft>) => void
  resetDraft: () => void
  /** 성공하면 생성된 id */
  addChore: (fields: ChoreFields, token: string) => Promise<string | null>
  updateChore: (id: string, fields: ChoreFields) => Promise<boolean>
  /** 목표 상태를 명시한다(토글 아님). 이미 그 상태면 아무 일도 하지 않는다 */
  setStatus: (id: string, status: ChoreStatus) => Promise<boolean>
  removeChore: (id: string) => Promise<boolean>
  loading: boolean
  error: string | null
  refresh: () => Promise<boolean>
}

export const ChoresContext = React.createContext<ChoresContextValue | null>(null)

export function useChores() {
  const ctx = React.useContext(ChoresContext)
  if (!ctx) throw new Error("useChores는 ChoresProvider 안에서만 쓸 수 있어요.")
  return ctx
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

export function emptyChoreDraft(ownerId: string | null, assignee: string): ChoreNewDraft {
  return { ownerId, title: "", memo: "", assigneeMemberId: assignee, dueDate: "", step: "compose", submitToken: crypto.randomUUID(), createdId: null }
}
