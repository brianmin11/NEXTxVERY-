import { redirect } from "next/navigation"

// 데모는 기본 가족에 들어간 상태로 시작한다. 온보딩은 /welcome, 실제 세션 분기는 인증 연결 후 여기서 정한다.
export default function Page() {
  redirect("/home")
}
