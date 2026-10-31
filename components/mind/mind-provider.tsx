"use client"

import * as React from "react"

import { DEMO_HOME, findMember, type Family, type FamilyMember } from "@/lib/home.fixture"
import type { MindDraft, MindMessage, MindResponse, MindStep } from "@/lib/mind/types"

/**
 * 마음 전하기 데모 상태. 메모리에만 있어 라우트 이동 중에는 유지되고 새로고침하면 초기화된다.
 * 실제 저장·알림·권한 검증은 없다. 백엔드 연결 시 이 provider의 dispatch 구현만 교체한다.
 */

type State = {
  /** 데모 인물(가상). 로그인이 아니다 */
  viewerId: string
  messages: MindMessage[]
  draft: MindDraft
}

type Action =
  | { type: "viewer/set"; viewerId: string }
  | { type: "draft/update"; patch: Partial<Omit<MindDraft, "step" | "confirmToken" | "sentMessageId">> }
  | { type: "draft/step"; step: MindStep; confirmToken?: string }
  | { type: "draft/reset" }
  | { type: "message/send"; message: MindMessage; confirmToken: string }
  | { type: "message/read"; id: string }
  | { type: "message/respond"; id: string; response: MindResponse }

const emptyDraft = (): MindDraft => ({
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

const initialState: State = {
  viewerId: DEMO_HOME.viewerId,
  messages: SEED_MESSAGES,
  draft: emptyDraft(),
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "viewer/set":
      if (action.viewerId === state.viewerId) return state
      // 다른 인물의 개인 입력이 남지 않도록 초안을 버린다.
      return { ...state, viewerId: action.viewerId, draft: emptyDraft() }
    case "draft/update":
      if (state.draft.step === "sent") return state
      return { ...state, draft: { ...state.draft, ...action.patch } }
    case "draft/step":
      return {
        ...state,
        draft: { ...state.draft, step: action.step, confirmToken: action.confirmToken ?? state.draft.confirmToken },
      }
    case "draft/reset":
      return { ...state, draft: emptyDraft() }
    case "message/send": {
      // 연타·중복 방지: 같은 확인 토큰이나 같은 id로는 한 번만 추가한다.
      if (state.draft.sentMessageId || state.draft.confirmToken !== action.confirmToken) return state
      if (state.messages.some((m) => m.id === action.message.id)) return state
      return {
        ...state,
        messages: [action.message, ...state.messages],
        draft: { ...state.draft, step: "sent", sentMessageId: action.message.id },
      }
    }
    case "message/read":
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.id && m.toId === state.viewerId && m.status === "sent" ? { ...m, status: "read" } : m
        ),
      }
    case "message/respond":
      return {
        ...state,
        messages: state.messages.map((m) => {
          if (m.id !== action.id || m.toId !== state.viewerId || m.response) return m
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
  dispatch: React.Dispatch<Action>
}

const MindContext = React.createContext<MindContextValue | null>(null)

export function MindProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(reducer, initialState)
  const family = DEMO_HOME.family
  const viewer = findMember(family, state.viewerId) ?? family.members[0]
  const draftDirty =
    state.draft.step !== "sent" && (state.draft.rawText.trim() !== "" || state.draft.outgoingText.trim() !== "")

  const value = React.useMemo<MindContextValue>(
    () => ({ family, viewer, viewerId: state.viewerId, messages: state.messages, draft: state.draft, draftDirty, dispatch }),
    [family, viewer, state.viewerId, state.messages, state.draft, draftDirty]
  )
  return <MindContext.Provider value={value}>{children}</MindContext.Provider>
}

export function useMind() {
  const ctx = React.useContext(MindContext)
  if (!ctx) throw new Error("useMind는 MindProvider 안에서만 쓸 수 있어요.")
  return ctx
}
