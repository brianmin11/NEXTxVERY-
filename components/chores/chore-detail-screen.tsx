"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { CalendarDays, Check, Clock, Pencil, SearchX, StickyNote, Trash2, Undo2, User } from "lucide-react"

import { useDemoViewer } from "@/components/demo/demo-viewer-provider"
import { FamilyAvatar } from "@/components/home/family-avatar"
import { DemoViewerSwitch } from "@/components/mind/demo-viewer-switch"
import { useReturnFocus } from "@/components/mind/use-return-focus"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AppShell } from "@/components/woorijip/app-shell"
import { EmptyState } from "@/components/woorijip/state-views"
import { formatDateKeyFull } from "@/lib/calendar/date"
import { canDeleteChore, canEditChore, canToggleChore } from "@/lib/chores/permissions"
import { formatDate, formatTime } from "@/lib/format"
import { findMember } from "@/lib/home.fixture"

import { dueLabel } from "./chore-card"
import { useChores } from "./chores-provider"
import { useBusyId } from "./chores-screen"

/** 집안일 상세. 완료/완료 취소, 수정, 삭제(확인)는 데모 권한 규칙을 따른다. */
export function ChoreDetailScreen({ id }: { id: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const { family, viewerId } = useDemoViewer()
  const chores = useChores()
  const chore = chores.choreById(id)
  const [notice, setNotice] = React.useState<string | null>(params.get("saved") ? "데모 할 일에 반영했어요" : null)
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const { busyId, mark } = useBusyId()
  const returnFocus = useReturnFocus()

  if (!chore) {
    return (
      <AppShell title="집안일" back="/chores" backLabel="집안일 목록으로 돌아가기">
        <EmptyState
          icon={SearchX}
          title="이 집안일을 찾을 수 없어요"
          description="삭제됐거나, 새로고침으로 데모 데이터가 초기화됐을 수 있어요."
          action={
            <Button asChild>
              <Link href="/chores">목록으로</Link>
            </Button>
          }
        />
      </AppShell>
    )
  }

  const assignee = findMember(family, chore.assigneeMemberId)
  const creator = findMember(family, chore.createdByMemberId)
  const completer = chore.completedByMemberId ? findMember(family, chore.completedByMemberId) : undefined
  const done = chore.status === "done"
  const due = dueLabel(chore, chores.today)
  const mayToggle = canToggleChore(chore, viewerId)
  const mayEdit = canEditChore(chore, viewerId)
  const mayDelete = canDeleteChore(chore, viewerId)

  function setStatus(next: "todo" | "done") {
    if (busyId) return
    if (chores.setStatus(chore!.id, next)) {
      mark(chore!.id)
      setNotice(next === "done" ? "완료로 표시했어요" : "완료를 취소했어요")
    }
  }

  function confirmDelete() {
    chores.removeChore(chore!.id)
    setConfirmOpen(false)
    router.replace("/chores")
  }

  return (
    <AppShell title="집안일" back="/chores" backLabel="집안일 목록으로 돌아가기">
      <DemoViewerSwitch />

      <article className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={done ? "secondary" : "outline"} className="h-6 gap-1 px-2">
            {done ? <Check aria-hidden="true" /> : <Clock aria-hidden="true" />}
            {done ? "완료" : "할 일"}
          </Badge>
          {due.overdue && (
            <Badge variant="outline" className="h-6 gap-1 px-2 text-muted-foreground">
              기한 지남
            </Badge>
          )}
          {chore.seed && (
            <Badge variant="outline" className="h-6 px-2 text-muted-foreground">
              데모 예시
            </Badge>
          )}
        </div>
        <h1 className="text-2xl leading-snug font-bold tracking-tight">{chore.title}</h1>
        <dl className="flex flex-col gap-2 text-sm">
          <Row icon={User} label="담당">
            <span className="flex items-center gap-2">
              {assignee && <FamilyAvatar member={assignee} size={24} decorative />}
              {assignee?.name ?? "가족"}
              {assignee && creator && assignee.id !== creator.id && (
                <span className="text-muted-foreground">· 지정됨(수락 아님)</span>
              )}
            </span>
          </Row>
          <Row icon={CalendarDays} label="날짜">
            {chore.dueDate ? <time dateTime={chore.dueDate}>{formatDateKeyFull(chore.dueDate)}</time> : "날짜 미정"}
            {due.isToday && <span className="ml-1 text-primary">오늘</span>}
          </Row>
          {chore.memo && (
            <Row icon={StickyNote} label="메모">
              <span className="whitespace-pre-wrap">{chore.memo}</span>
            </Row>
          )}
        </dl>
        <p className="text-sm text-muted-foreground">
          {creator?.name ?? "가족"}이(가) 만듦 · <time dateTime={chore.createdAt}>{formatDate(new Date(chore.createdAt))}</time>
          {done && chore.completedAt && (
            <>
              {" "}
              · {completer?.name ?? "가족"}이(가) <time dateTime={chore.completedAt}>{formatDate(new Date(chore.completedAt))} {formatTime(new Date(chore.completedAt))}</time> 완료
            </>
          )}
        </p>
      </article>

      {notice && (
        <p role="status" className="rounded-xl bg-secondary px-4 py-2 text-sm">
          {notice}
        </p>
      )}

      <section aria-label="동작" className="flex flex-col gap-2">
        {mayToggle ? (
          done ? (
            <Button variant="outline" size="lg" disabled={busyId === chore.id} onClick={() => setStatus("todo")}>
              <Undo2 aria-hidden="true" />
              완료 취소
            </Button>
          ) : (
            <Button size="lg" disabled={busyId === chore.id} onClick={() => setStatus("done")}>
              <Check aria-hidden="true" />
              완료로 표시
            </Button>
          )
        ) : (
          <p className="text-sm text-muted-foreground">담당자나 만든 사람만 완료 표시를 바꿀 수 있어요 (프론트 데모 규칙).</p>
        )}
        {mayEdit && (
          <Button variant="outline" size="lg" asChild>
            <Link href={`/chores/${chore.id}/edit`}>
              <Pencil aria-hidden="true" />
              수정
            </Link>
          </Button>
        )}
        {mayDelete && done && <p className="text-sm text-muted-foreground">수정하려면 먼저 완료를 취소해 주세요.</p>}
        {mayDelete && (
          <Button
            variant="destructive"
            size="lg"
            onClick={() => {
              returnFocus.capture()
              setConfirmOpen(true)
            }}
          >
            <Trash2 aria-hidden="true" />
            삭제
          </Button>
        )}
        {!mayEdit && !mayDelete && !done && (
          <p className="text-sm text-muted-foreground">수정·삭제는 만든 사람만 할 수 있어요 (프론트 데모 규칙).</p>
        )}
      </section>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent onCloseAutoFocus={returnFocus.onCloseAutoFocus}>
          <DialogHeader>
            <DialogTitle>‘{chore.title}’을(를) 삭제할까요?</DialogTitle>
            <DialogDescription>데모 할 일에서만 지워지고 되돌릴 수 없어요.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              취소
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}

function Row({ icon: Icon, label, children }: { icon: typeof User; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <dt className="flex w-12 shrink-0 items-center gap-1.5 pt-0.5 text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
        {label}
      </dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  )
}
