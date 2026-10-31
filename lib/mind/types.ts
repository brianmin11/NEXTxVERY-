/** 수신자가 한 응답. 열람(read)은 응답이 아니다. */
export type MindResponse =
  | { kind: "reply"; text: string; at: string }
  | { kind: "later"; at: string }
  | { kind: "declined"; at: string }

export type MindMessageStatus = "sent" | "read" | "replied" | "later" | "declined"

/**
 * 가족에게 공유되는 메시지 객체. 전달 문장(text)만 담는다.
 * 작성자의 원문(rawText)·개인 메모는 어떤 필드로도 넣지 않는다.
 */
export type MindMessage = {
  revision?: number
  id: string
  fromId: string
  toId: string
  text: string
  /** ISO 8601 */
  createdAt: string
  status: MindMessageStatus
  response: MindResponse | null
  /** 가상 예시 데이터 표시용 */
  seed?: boolean
}

export type MindStep = "compose" | "refine" | "confirm" | "sent"

/**
 * 작성자 개인 상태. 메모리에만 있고 라우트 이동 중에는 유지, 새로고침·데모 인물 전환 시 초기화.
 * 공유 메시지와 분리돼 있어 rawText는 MindMessage로 넘어가지 않는다.
 */
export type MindDraft = {
  recipientId: string | null
  rawText: string
  outgoingText: string
  step: MindStep
  /** 확인 화면에 들어올 때 발급. 같은 토큰으로는 한 번만 전송된다. */
  confirmToken: string | null
  sentMessageId: string | null
}
