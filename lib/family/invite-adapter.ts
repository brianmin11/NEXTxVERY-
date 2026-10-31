import type { MemberTone } from "@/components/woorijip/member"

/** 초대코드 조회 결과. 화면은 이 네 가지 상태만 다룬다. */
export type InviteLookup =
  | {
      status: "ok"
      family: { id: string; name: string; adminName: string; members: { id: string; name: string; tone: MemberTone }[] }
    }
  | { status: "not-found" }
  | { status: "expired" }
  | { status: "already-member" }
  | { status: "error"; message: string }

/**
 * 초대코드 조회 교체 지점. 실제 서비스에서는 서버 API(코드 검증·만료·사용 횟수)를 호출하는 어댑터로 바꾼다.
 * 데모 어댑터는 메모리 가족 목록에서 찾고, 네트워크 지연을 흉내 내기 위해 잠깐 기다린다.
 */
export type InviteAdapter = {
  readonly isDemo: boolean
  lookup: (code: string, signal?: AbortSignal) => Promise<InviteLookup>
}

/** 데모에서 '만료된 코드'를 보여 주기 위한 고정 코드 */
export const DEMO_EXPIRED_CODE = "OLD000"

export function createDemoInviteAdapter(find: (code: string) => InviteLookup, delayMs = 500): InviteAdapter {
  return {
    isDemo: true,
    lookup: (code, signal) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(find(code)), delayMs)
        signal?.addEventListener("abort", () => {
          clearTimeout(timer)
          reject(new DOMException("aborted", "AbortError"))
        })
      }),
  }
}
