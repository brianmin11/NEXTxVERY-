import type { Metadata } from "next"

import { ChoreNewScreen } from "@/components/chores/chore-new-screen"

export const metadata: Metadata = { title: "집안일 추가" }

export default function ChoreNewPage() {
  return <ChoreNewScreen />
}
