import type { Metadata } from "next"

import { EventEditScreen } from "@/components/calendar/event-edit-screen"

export const metadata: Metadata = { title: "일정 수정" }

export default async function EventEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <EventEditScreen id={id} />
}
