"use client"

import * as React from "react"
import Link from "next/link"
import { Heart, Inbox, Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AppShell, DemoBadge } from "@/components/woorijip/app-shell"
import { EmptyState } from "@/components/woorijip/state-views"

import { DemoViewerSwitch } from "./demo-viewer-switch"
import { MindCard } from "./mind-card"
import { useMind } from "./mind-provider"

export type InboxTab = "received" | "sent"

/** 받은 마음 / 보낸 마음. 데모 인물 기준으로 필터하며 원문은 어디에도 없다. */
export function InboxScreen({ initialTab = "received" }: { initialTab?: InboxTab }) {
  const { family, viewerId, messages, dispatch } = useMind()
  const [tab, setTab] = React.useState<InboxTab>(initialTab)
  const received = messages.filter((m) => m.toId === viewerId)
  const sent = messages.filter((m) => m.fromId === viewerId)

  return (
    <AppShell
      title={<h1 className="text-lg font-bold">마음 수신함</h1>}
      actions={
        <Button variant="ghost" asChild>
          <Link href="/mind">
            <Heart aria-hidden="true" />
            마음 전하기
          </Link>
        </Button>
      }
    >
      <DemoBadge />
      <DemoViewerSwitch />
      <p className="text-sm text-muted-foreground">메모리에만 있는 데모예요. 새로고침하면 보낸 내용이 사라져요.</p>
      <Tabs value={tab} onValueChange={(v) => setTab(v as InboxTab)}>
        <TabsList aria-label="수신함 구분" className="w-full">
          <TabsTrigger value="received" className="flex-1">
            받은 마음 {received.length > 0 && <span className="tabular-nums">({received.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="sent" className="flex-1">
            보낸 마음 {sent.length > 0 && <span className="tabular-nums">({sent.length})</span>}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="received" className="flex flex-col gap-3 pt-3">
          {received.length === 0 ? (
            <EmptyState icon={Inbox} title="아직 받은 마음이 없어요" description="가족이 보낸 전달 문장이 여기에 보여요." />
          ) : (
            received.map((m) => (
              <MindCard
                key={m.id}
                message={m}
                family={family}
                direction="received"
                // 열어 보면 '열람함'. 수락이 아니다.
                onOpen={() => dispatch({ type: "message/read", id: m.id })}
              />
            ))
          )}
        </TabsContent>
        <TabsContent value="sent" className="flex flex-col gap-3 pt-3">
          {sent.length === 0 ? (
            <EmptyState
              icon={Send}
              title="아직 보낸 마음이 없어요"
              description="전달 문장을 확인해서 추가하면 여기에 보여요."
              action={
                <Button asChild>
                  <Link href="/mind">마음 전하기</Link>
                </Button>
              }
            />
          ) : (
            sent.map((m) => <MindCard key={m.id} message={m} family={family} direction="sent" />)
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  )
}
