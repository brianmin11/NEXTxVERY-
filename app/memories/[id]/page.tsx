import type { Metadata } from "next"

import { MemoryDetailScreen } from "@/components/memories/memory-detail-screen"

export const metadata: Metadata = { title: "추억 상세" }

export default async function MemoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <MemoryDetailScreen id={id} />
}
