/**
 * Relationship AI 연결 지점.
 * 지금은 데모 어댑터만 있다: 문장을 생성하지 않고, 작성자의 원문을 편집 초안으로 돌려준다.
 * 실제 AI가 붙으면 같은 인터페이스를 구현한 어댑터로 교체하고 UI는 그대로 둔다.
 * 어댑터 안에 API URL·키·DB 호출을 넣지 않는다. 그런 연결은 백엔드 담당이 서버 쪽에서 맡는다.
 */

export type DraftRequest = {
  rawText: string
  recipientName: string
}

export type DraftResult =
  /** AI 없이 작성자가 직접 다듬는다. initialText는 원문 그대로 */
  | { mode: "manual"; initialText: string; label: string }
  /** 실제 AI 제안(아직 구현 없음) */
  | { mode: "suggested"; text: string; label: string }

export type RelationshipAdapter = {
  name: string
  /** true면 UI가 '데모'로 표시한다 */
  isDemo: boolean
  draftOutgoing: (request: DraftRequest) => Promise<DraftResult>
}

export const relationshipDemoAdapter: RelationshipAdapter = {
  name: "demo-manual",
  isDemo: true,
  async draftOutgoing({ rawText }) {
    return { mode: "manual", initialText: rawText, label: "AI 연결 전 직접 다듬기" }
  },
}

/** 현재 사용 중인 어댑터. 실제 연결 시 이 한 줄을 바꾼다. */
export const relationshipAdapter: RelationshipAdapter = relationshipDemoAdapter

/** '예시 흐름 보기'에 쓰는 합성 예시. 사용자의 입력과 무관하며 작성 중인 내용을 묻지 않고 덮어쓰지 않는다. */
export const SYNTHETIC_EXAMPLE = {
  raw: "요즘 대화가 줄어서 서운했어. 내가 너무 잔소리만 한 것 같기도 하고.",
  outgoing: "요즘 바빠 보여서 걱정됐어. 시간 될 때 이야기 나누고 싶어.",
} as const
