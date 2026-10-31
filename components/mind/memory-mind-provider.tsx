"use client"

import * as React from "react"

import { useFamily } from "@/components/family/family-context"
import type { MindDraft, MindMessage } from "@/lib/mind/types"

import { emptyMindDraft, MindContext, type MindAction, type MindContextValue } from "./mind-context"

/**
 * 마음 전하기 데모 상태(메모리). 라우트 이동 중에는 유지되고 새로고침하면 초기화된다.
 * 초안은 작성한 인물(ownerId)에게만 보이므로 인물을 바꾸면 다른 인물의 입력이 화면에 남지 않는다.
 * 실제 저장·알림·AI·권한 검증은 없다.
 */

type OwnedDraft = MindDraft & { ownerId: string | null }

type State = {
  messages: MindMessage[]
  draft: OwnedDraft
}

type InternalAction = MindAction & { viewerId: string }

const emptyDraft = (ownerId: string | null = null): OwnedDraft => ({ ownerId, ...emptyMindDraft() })

/** 가상 예시 메시지. 원문 없이 전달 문장만 있다. */
const SEED_MESSAGES: MindMessage[] = [
  {
    id: "seed-hajun-mom",
    fromId: "hajun",
    toId: "mom",
    text: "엄마, 요즘 학교 이야기 들어줘서 고마워요. 주말에 같이 보드게임 해요!",
    createdAt: "2026-10-30T20:10:00+09:00",
    status: "sent",
    response: null,
    seed: true,
  },
]

const initialState = (seeded: boolean): State => ({ messages: seeded ? SEED_MESSAGES : [], draft: emptyDraft() })

function ownDraft(state: State, viewerId: string): OwnedDraft {
  return state.draft.ownerId === viewerId ? state.draft : emptyDraft(viewerId)
}

function reducer(state: State, action: InternalAction): State {
  const { viewerId } = action
  switch (action.type) {
    case "draft/update": {
      const draft = ownDraft(state, viewerId)
      if (draft.step === "sent") return state
      return { ...state, draft: { ...draft, ...action.patch } }
    }
    case "draft/step": {
      const draft = ownDraft(state, viewerId)
      return { ...state, draft: { ...draft, step: action.step, confirmToken: action.confirmToken ?? draft.confirmToken } }
    }
    case "draft/reset":
      return { ...state, draft: emptyDraft(viewerId) }
    case "message/send": {
      const draft = ownDraft(state, viewerId)
      // 연타·중복 방지: 같은 확인 토큰이나 같은 id로는 한 번만 추가한다.
      if (draft.sentMessageId || draft.confirmToken !== action.confirmToken) return state
      if (state.messages.some((m) => m.id === action.message.id)) return state
      return {
        ...state,
        messages: [action.message, ...state.messages],
        draft: { ...draft, step: "sent", sentMessageId: action.message.id },
      }
    }
    case "message/read":
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.id && m.toId === viewerId && m.status === "sent" ? { ...m, status: "read" } : m
        ),
      }
    case "message/respond":
      return {
        ...state,
        messages: state.messages.map((m) => {
          if (m.id !== action.id || m.toId !== viewerId || m.response) return m
          const status = action.response.kind === "reply" ? "replied" : action.response.kind === "later" ? "later" : "declined"
          return { ...m, status, response: action.response }
        }),
      }
  }
}

export function MemoryMindProvider({ children, seeded = true }: { children: React.ReactNode; seeded?: boolean }) {
  const { family, viewer, viewerId } = useFamily()
  const [state, rawDispatch] = React.useReducer(reducer, seeded, initialState)
  const draft = ownDraft(state, viewerId)
  const draftDirty = draft.step !== "sent" && (draft.rawText.trim() !== "" || draft.outgoingText.trim() !== "")

  const value: MindContextValue = {
    family,
    viewer,
    viewerId,
    messages: state.messages,
    draft,
    draftDirty,
    dispatch: async (action) => {
      rawDispatch({ ...action, viewerId })
      return true
    },
    canSuggest: false,
    suggest: async () => {},
    suggestion: { phase: "idle", label: null, error: null },
    loading: false,
    error: null,
    refresh: async () => true,
  }
  return <MindContext.Provider value={value}>{children}</MindContext.Provider>
}
