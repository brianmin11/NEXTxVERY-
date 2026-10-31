import { INVITE_CODE_LENGTH } from "./config"

/** 데모 초대코드 생성(영문 대문자·숫자). 실제 발급·만료·검증은 서버가 맡는다. */
export function generateInviteCode(random: () => number = Math.random) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) code += chars[Math.floor(random() * chars.length)]
  return code
}

/** 공유용 링크. 코드만 들어가고 개인 정보는 담지 않는다. */
export function inviteLink(code: string, origin: string) {
  return `${origin}/join?code=${encodeURIComponent(code)}`
}
