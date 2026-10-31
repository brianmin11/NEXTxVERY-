"use client"

import * as React from "react"

import { useDemoViewer } from "@/components/demo/demo-viewer-provider"
import type { Family, FamilyMember } from "@/lib/home.fixture"
import type { MindDraft, MindMessage, MindResponse, MindStep } from "@/lib/mind/types"

/**
 * 마음 전하기 데모 상태. 메모리에만 있어 라우트 이동 중에는 유지되고 새로고침하면 초기화된다.
 * 현재 인물은 DemoViewerProvider가 가진다. 초안은 작성한 인물(ownerId)에게만 보이므로
 * 인물을 바꾸면 다른 인물의 입력이 화면에 남지 않는다.
 * 실제 저장·알림·권한 검증은 없다. 백엔드 연결 시 이 provider의 dispatch 구현만 교체한다.
 */

type OwnedDraft = MindDraft & { ownerId: string | null }

type State = {
  messages: MindMessage[]
  draft: OwnedDraft
}

/** 화면이 보내는 액션. 현재 인물은 provider가 붙인다. */
export type MindAction =
  | { type: "draft/update"; patch: Partial<Omit<MindDraft, "step" | "confirmToken" | "sentMessageId">> }
  | { type: "draft/step"; step: MindStep; confirmToken?: string }
  | { type: "draft/reset" }
  | { type: "message/send"; message: MindMessage; confirmToken: string }
  | { type: "message/read"; id: string }
  | { type: "message/respond"; id: string; response: MindResponse }

type InternalAction = MindAction & { viewerId: string }

const emptyDraft = (ownerId: string | null = null): OwnedDraft => ({
  ownerId,
  recipientId: null,
  rawText: "",
  outgoingText: "",
  step: "compose",
  confirmToken: null,
  sentMessageId: null,
})

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

const initialState: State = { messages: SEED_MESSAGES, draft: emptyDraft() }

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
          const status =
            action.response.kind === "reply" ? "replied" : action.response.kind === "later" ? "later" : "declined"
          return { ...m, status, response: action.response }
        }),
      }
  }
}

type MindContextValue = {
  family: Family
  viewer: FamilyMember
  viewerId: string
  messages: MindMessage[]
  draft: MindDraft
  /** 작성 중인 내용이 있고 아직 전송 전이면 true */
  draftDirty: boolean
  dispatch: (action: MindAction) => void
}

const MindContext = React.createContext<MindContextValue | null>(null)

export function MindProvider({ children }: { children: React.ReactNode }) {
  const { family, viewer, viewerId } = useDemoViewer()
  const [state, rawDispatch] = React.useReducer(reducer, initialState)
  const draft = ownDraft(state, viewerId)
  const draftDirty = draft.step !== "sent" && (draft.rawText.trim() !== "" || draft.outgoingText.trim() !== "")

  const dispatch = (action: MindAction) => rawDispatch({ ...action, viewerId })

  const value: MindContextValue = { family, viewer, viewerId, messages: state.messages, draft, draftDirty, dispatch }
  return <MindContext.Provider value={value}>{children}</MindContext.Provider>
}

export function useMind() {
  const ctx = React.useContext(MindContext)
  if (!ctx) throw new Error("useMind는 MindProvider 안에서만 쓸 수 있어요.")
  return ctx
}
