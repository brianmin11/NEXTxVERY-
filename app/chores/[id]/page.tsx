import type { Metadata } from "next"
import { Suspense } from "react"

import { ChoreDetailScreen } from "@/components/chores/chore-detail-screen"

export const metadata: Metadata = { title: "집안일 상세" }

export default async function ChoreDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <Suspense>
      <ChoreDetailScreen id={id} />
    </Suspense>
  )
}
