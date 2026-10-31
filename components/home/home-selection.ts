/** 홈에서 한 번에 하나만 열리는 상세 시트의 대상. 마음 전하기는 /mind 전체 화면으로 간다. */
export type HomeSelection =
  | { type: "schedule"; id: string }
  | { type: "member"; id: string }
  | { type: "family" }
  | { type: "notifications" }
