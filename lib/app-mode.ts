/**
 * 데이터 모드. 기본은 실제 서버(live)이며, `NEXT_PUBLIC_APP_MODE=demo`일 때만 메모리 데모 상태를 쓴다.
 * 두 모드는 provider 구현만 다르고 화면·훅 인터페이스는 같다. 데모 인물 전환·고정 초대코드·seed는 데모 모드에서만 존재한다.
 */
export type AppMode = "live" | "demo"

export const APP_MODE: AppMode = process.env.NEXT_PUBLIC_APP_MODE === "demo" ? "demo" : "live"

export const IS_DEMO = APP_MODE === "demo"
