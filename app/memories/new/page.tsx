import type { Metadata } from "next"

import { MemoryNewScreen } from "@/components/memories/memory-new-screen"

export const metadata: Metadata = { title: "추억 등록" }

export default function MemoryNewPage() {
  return <MemoryNewScreen />
}
