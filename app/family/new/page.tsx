import type { Metadata } from "next"

import { CreateFamilyScreen } from "@/components/onboarding/create-family-screen"

export const metadata: Metadata = { title: "새 가족 만들기" }

export default function NewFamilyPage() {
  return <CreateFamilyScreen />
}
