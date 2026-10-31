/** 홈에서 한 번에 하나만 열리는 상세 시트의 대상 */
export type HomeSelection =
  | { type: "schedule"; id: string }
  | { type: "member"; id: string }
  | { type: "family" }
  | { type: "notifications" }
  | { type: "heart" }
