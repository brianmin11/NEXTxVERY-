import type { Metadata } from "next"

import { LoginScreen } from "@/components/auth/login-screen"

export const metadata: Metadata = { title: "로그인" }

// 라이브 모드 로그인/계정 만들기. 세션이 있으면 FamilyScope가 /home으로 보낸다.
export default function LoginPage() {
  return <LoginScreen />
}
