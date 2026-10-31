import type { Metadata } from "next"

import { InboxScreen, type InboxTab } from "@/components/mind/inbox-screen"

export const metadata: Metadata = { title: "마음 수신함" }

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  const initialTab: InboxTab = tab === "sent" ? "sent" : "received"
  return <InboxScreen initialTab={initialTab} />
}
