"use client"

import * as React from "react"
import Link from "next/link"
import { CheckCircle2, ClipboardList, Plus } from "lucide-react"

import { useDemoViewer } from "@/components/demo/demo-viewer-provider"
import { DemoViewerSwitch } from "@/components/mind/demo-viewer-switch"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AppShell, DemoBadge } from "@/components/woorijip/app-shell"
import { EmptyState } from "@/components/woorijip/state-views"
import type { ChoreStatus } from "@/lib/chores/types"

import { ChoreCard } from "@/components/chores/chore-card"
import { useChores } from "./chores-provider"

type Scope = "mine" | "all"

/** 상태 변경 직후 잠깐 조작을 막아 두 번 눌러 되돌아가는 일을 막는다. */
export function useBusyId() {
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const timer = React.useRef<number | null>(null)
  React.useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current)
    },
    []
  )
  const mark = (id: string) => {
    setBusyId(id)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setBusyId(null), 700)
  }
  return { busyId, mark }
}

export function ChoresScreen() {
  const { family, viewerId, viewer } = useDemoViewer()
  const chores = useChores()
  const [scope, setScope] = React.useState<Scope>("mine")
  const [status, setStatus] = React.useState<ChoreStatus>("todo")
  const [notice, setNotice] = React.useState<string | null>(null)
  const { busyId, mark } = useBusyId()
  const list = chores.listChores(status, scope === "mine")

  async function handleSetStatus(id: string, next: ChoreStatus) {
    if (busyId) return
    const ok = await chores.setStatus(id, next)
    if (ok) {
      mark(id)
      setNotice(next === "done" ? "완료로 표시했어요" : "완료를 취소했어요")
    }
  }

  const emptyText =
    scope === "mine"
      ? status === "todo"
        ? {
            title: `${viewer.name}의 할 일이 없어요`,
            desc: "맡은 집안일이 생기면 여기에 보여요.",
          }
        : {
            title: "완료한 집안일이 없어요",
            desc: "할 일을 완료로 표시하면 여기에 모여요.",
          }
      : status === "todo"
        ? {
            title: "가족 전체 할 일이 없어요",
            desc: "첫 집안일을 추가해 보세요.",
          }
        : {
            title: "완료된 집안일이 없어요",
            desc: "가족이 완료한 일이 여기에 모여요.",
          }

  return (
    <AppShell
      title={<h1 className="text-lg font-bold">집안일</h1>}
      actions={
        <Button variant="ghost" asChild>
          <Link href="/chores/new">
            <Plus aria-hidden="true" />
            추가
          </Link>
        </Button>
      }
    >
      <DemoBadge />
      <DemoViewerSwitch />
      <p className="text-sm text-muted-foreground">
        가족과 나눈 집안일과 완료 기록을 확인해요.
      </p>

      <Tabs value={scope} onValueChange={(v) => setScope(v as Scope)}>
        <TabsList aria-label="범위" className="w-full">
          <TabsTrigger value="mine" className="flex-1">
            내 할 일
          </TabsTrigger>
          <TabsTrigger value="all" className="flex-1">
            가족 전체
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <Tabs value={status} onValueChange={(v) => setStatus(v as ChoreStatus)}>
        <TabsList aria-label="상태" className="w-full">
          <TabsTrigger value="todo" className="flex-1">
            할 일
          </TabsTrigger>
          <TabsTrigger value="done" className="flex-1">
            완료
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {notice && (
        <p role="status" className="rounded-xl bg-secondary px-4 py-2 text-sm">
          {notice}
        </p>
      )}

      {list.length === 0 ? (
        <EmptyState
          icon={status === "todo" ? ClipboardList : CheckCircle2}
          title={emptyText.title}
          description={emptyText.desc}
          action={
            status === "todo" ? (
              <Button asChild>
                <Link href="/chores/new">
                  <Plus aria-hidden="true" />
                  집안일 추가
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul
          className="flex flex-col gap-2"
          aria-label={`${scope === "mine" ? "내" : "가족 전체"} ${status === "todo" ? "할 일" : "완료"} 목록`}
        >
          {list.map((c) => (
            <li key={c.id}>
              <ChoreCard
                chore={c}
                family={family}
                viewerId={viewerId}
                today={chores.today}
                busy={busyId === c.id}
                onSetStatus={handleSetStatus}
              />
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  )
}
