import type { Metadata } from "next"

import { MindDetailScreen } from "@/components/mind/mind-detail-screen"

export const metadata: Metadata = { title: "마음 상세" }

export default async function MindDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <MindDetailScreen id={id} />
}
