"use client"

import * as React from "react"

import type { Family, FamilyMember } from "@/lib/family/types"
import type { MindDraft, MindMessage, MindResponse, MindStep } from "@/lib/mind/types"

/** 화면이 보내는 액션. 현재 인물은 provider가 붙인다. */
export type MindAction =
  | { type: "draft/update"; patch: Partial<Omit<MindDraft, "step" | "confirmToken" | "sentMessageId">> }
  | { type: "draft/step"; step: MindStep; confirmToken?: string }
  | { type: "draft/reset" }
  | { type: "message/send"; message: MindMessage; confirmToken: string }
  | { type: "message/read"; id: string }
  | { type: "message/respond"; id: string; response: MindResponse }

export type SuggestionPhase = "idle" | "loading" | "success" | "error"

/** 마음 전하기 상태의 공통 모양. 데모(메모리)와 라이브(서버) provider가 같은 인터페이스를 제공한다. */
export type MindContextValue = {
  family: Family
  viewer: FamilyMember
  viewerId: string
  messages: MindMessage[]
  draft: MindDraft
  /** 작성 중인 내용이 있고 아직 전송 전이면 true */
  draftDirty: boolean
  /** 성공 여부를 돌려준다. 전송·응답 실패는 `error`에 문구가 남는다 */
  dispatch: (action: MindAction) => Promise<boolean>
  /** 실제 AI 제안이 연결돼 있는지. 데모는 false */
  canSuggest: boolean
  /** 사용자가 명시적으로 요청할 때만 호출한다. 원문·수신자가 바뀌면 이전 제안은 무효가 된다 */
  suggest: () => Promise<void>
  suggestion: { phase: SuggestionPhase; label: string | null; error: string | null }
  loading: boolean
  error: string | null
  refresh: () => Promise<boolean>
}

export const MindContext = React.createContext<MindContextValue | null>(null)

export function useMind() {
  const ctx = React.useContext(MindContext)
  if (!ctx) throw new Error("useMind는 MindProvider 안에서만 쓸 수 있어요.")
  return ctx
}

export function emptyMindDraft(): MindDraft {
  return { recipientId: null, rawText: "", outgoingText: "", step: "compose", confirmToken: null, sentMessageId: null }
}
