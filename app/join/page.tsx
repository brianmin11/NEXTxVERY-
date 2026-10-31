import type { Metadata } from "next"

import { JoinFamilyScreen } from "@/components/onboarding/join-family-screen"

export const metadata: Metadata = { title: "가족 공간 참여" }

// 초대 링크(/join?code=)로 들어오면 코드를 미리 채운다. 코드는 로그인을 대체하지 않는다.
export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams
  return <JoinFamilyScreen initialCode={typeof code === "string" ? code : ""} />
}
