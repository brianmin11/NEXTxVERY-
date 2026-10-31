import type { Metadata } from "next"

import { ChoreEditScreen } from "@/components/chores/chore-edit-screen"

export const metadata: Metadata = { title: "집안일 수정" }

export default async function ChoreEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ChoreEditScreen id={id} />
}
