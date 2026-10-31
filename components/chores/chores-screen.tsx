"use client"

import * as React from "react"
import Link from "next/link"
import { CheckCircle2, ClipboardList, Plus } from "lucide-react"

import { useDemoViewer } from "@/components/demo/demo-viewer-provider"
import { DemoViewerSwitch } from "@/components/mind/demo-viewer-switch"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AppShell } from "@/components/woorijip/app-shell"
import { EmptyState } from "@/components/woorijip/state-views"
import type { ChoreStatus } from "@/lib/chores/types"

import { ChoreCard } from "./chore-card"
import { useChores } from "./chores-provider"

type Scope = "mine" | "all"

/** 상태 변경 직후 잠깐 조작을 막아 두 번 눌러 되돌아가는 일을 막는다. */
export function useBusyId() {
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const timer = React.useRef<number | null>(null)
  React.useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])
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

  function handleSetStatus(id: string, next: ChoreStatus) {
    if (busyId) return
    const ok = chores.setStatus(id, next)
    if (ok) {
      mark(id)
      setNotice(next === "done" ? "완료로 표시했어요" : "완료를 취소했어요")
    }
  }

  const emptyText =
    scope === "mine"
      ? status === "todo"
        ? { title: `${viewer.name}의 할 일이 없어요`, desc: "맡은 집안일이 생기면 여기에 보여요." }
        : { title: "완료한 집안일이 없어요", desc: "할 일을 완료로 표시하면 여기에 모여요." }
      : status === "todo"
        ? { title: "가족 전체 할 일이 없어요", desc: "첫 집안일을 추가해 보세요." }
        : { title: "완료된 집안일이 없어요", desc: "가족이 완료한 일이 여기에 모여요." }

  return (
    <AppShell
      title="집안일"
      mainClassName="gap-4"
      actions={
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="할 일 추가" asChild>
          <Link href="/chores/new">
            <Plus className="size-5" aria-hidden="true" />
          </Link>
        </Button>
      }
    >
      <DemoViewerSwitch />
      <p className="text-sm text-muted-foreground">메모리에만 있는 데모예요. 새로고침하면 추가·완료 기록이 사라져요.</p>

      <div className="-mx-4 flex flex-col gap-1">
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
      </div>

      {notice && (
        <p role="status" className="rounded-lg bg-secondary px-4 py-2 text-sm">
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
        <section className="flex flex-col gap-1" aria-label={`${scope === "mine" ? "내" : "가족 전체"} ${status === "todo" ? "할 일" : "완료"} 목록`}>
          <p className="text-xs text-muted-foreground tabular-nums">
            {status === "todo" ? "할 일" : "완료"} {list.length}
          </p>
          <ul className="flex flex-col divide-y divide-border border-t border-border">
            {list.map((c) => (
              <li key={c.id}>
                <ChoreCard chore={c} family={family} viewerId={viewerId} today={chores.today} busy={busyId === c.id} onSetStatus={handleSetStatus} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </AppShell>
  )
}
