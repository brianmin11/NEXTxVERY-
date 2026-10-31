"use client"

import * as React from "react"
import Link from "next/link"
import { Inbox, LockKeyhole, Pencil, Send } from "lucide-react"

import { DemoViewerSwitch } from "@/components/demo/demo-viewer-switch"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AppShell } from "@/components/woorijip/app-shell"
import { EmptyState } from "@/components/woorijip/state-views"

import { MindCard } from "./mind-card"
import { useMind } from "./mind-provider"

export type InboxTab = "received" | "sent"

/** 받은 마음 / 보낸 마음. 데모 인물 기준으로 필터하며 원문은 어디에도 없다. */
export function InboxScreen({ initialTab = "received" }: { initialTab?: InboxTab }) {
  const { family, viewerId, messages } = useMind()
  const [tab, setTab] = React.useState<InboxTab>(initialTab)
  const received = messages.filter((m) => m.toId === viewerId)
  const sent = messages.filter((m) => m.fromId === viewerId)

  return (
    <AppShell
      title="마음 수신함"
      back="/home"
      backLabel="우리집으로"
      hideNav
      actions={
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="새 마음 전하기" asChild>
          <Link href="/mind">
            <Pencil className="size-5" aria-hidden="true" />
          </Link>
        </Button>
      }
    >
      <DemoViewerSwitch />
      <Tabs value={tab} onValueChange={(v) => setTab(v as InboxTab)} className="-mx-4">
        <TabsList aria-label="수신함 구분">
          <TabsTrigger value="received">
            받은 마음 {received.length > 0 && <span className="tabular-nums">({received.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="sent">
            보낸 마음 {sent.length > 0 && <span className="tabular-nums">({sent.length})</span>}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="received" className="px-4">
          {received.length === 0 ? (
            <EmptyState icon={Inbox} title="아직 받은 마음이 없어요" description="가족이 보낸 전달 문장이 여기에 보여요." className="mt-4" />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {received.map((m) => (
                <MindCard key={m.id} message={m} family={family} direction="received" />
              ))}
            </ul>
          )}
        </TabsContent>
        <TabsContent value="sent" className="px-4">
          {sent.length === 0 ? (
            <EmptyState
              icon={Send}
              title="아직 보낸 마음이 없어요"
              description="전달 문장을 확인해서 전송하면 여기에 보여요."
              className="mt-4"
              action={
                <Button asChild>
                  <Link href="/mind">마음 전하기</Link>
                </Button>
              }
            />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {sent.map((m) => (
                <MindCard key={m.id} message={m} family={family} direction="sent" />
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
      <p className="flex items-center justify-center gap-1.5 py-4 text-xs text-muted-foreground">
        <LockKeyhole className="size-3.5" aria-hidden="true" />
        개인 원문과 초안은 수신함에 전달되지 않아요. 메모리 데모라 새로고침하면 사라져요.
      </p>
    </AppShell>
  )
}
