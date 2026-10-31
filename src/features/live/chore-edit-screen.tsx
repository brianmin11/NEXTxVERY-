"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { SearchX, X } from "lucide-react"

import { useDemoViewer } from "@/components/demo/demo-viewer-provider"
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
import { AppShell, DemoBadge } from "@/components/woorijip/app-shell"
import { EmptyState } from "@/components/woorijip/state-views"
import { canEditChore } from "@/lib/chores/permissions"
import type { ChoreDraft } from "@/lib/chores/types"
import {
  choreDraftsEqual,
  choreToDraft,
  draftToChoreFields,
} from "@/lib/chores/validate"

import { ChoreForm } from "@/components/chores/chore-form"
import { useChores } from "./chores-provider"

/** 집안일 수정(전체 화면). 복사한 초안을 편집하고 저장 전에는 원본을 바꾸지 않는다. */
export function ChoreEditScreen({ id }: { id: string }) {
  const router = useRouter()
  const { family, viewerId } = useDemoViewer()
  const chores = useChores()
  const chore = chores.choreById(id)
  return chore && canEditChore(chore, viewerId) ? (
    <Editor
      key={chore.id}
      initial={choreToDraft(chore)}
      choreId={chore.id}
      family={family}
    />
  ) : (
    <AppShell
      title={
        <Button
          variant="ghost"
          size="icon"
          aria-label="집안일 목록으로 돌아가기"
          onClick={() => router.push("/chores")}
        >
          <X className="size-5" aria-hidden="true" />
        </Button>
      }
    >
      <DemoBadge />
      <DemoViewerSwitch />
      <EmptyState
        icon={SearchX}
        title={chore ? "지금은 수정할 수 없어요" : "이 집안일을 찾을 수 없어요"}
        description={
          chore
            ? chore.status === "done"
              ? "완료된 항목은 완료를 취소한 뒤 수정할 수 있어요."
              : "만든 사람만 수정할 수 있어요 (프론트 데모 규칙)."
            : "삭제됐거나, 새로고침으로 데모 데이터가 초기화됐을 수 있어요."
        }
        action={
          <Button asChild>
            <Link href={chore ? `/chores/${chore.id}` : "/chores"}>
              {chore ? "상세로" : "목록으로"}
            </Link>
          </Button>
        }
      />
    </AppShell>
  )
}

function Editor({
  initial,
  choreId,
  family,
}: {
  initial: ChoreDraft
  choreId: string
  family: ReturnType<typeof useDemoViewer>["family"]
}) {
  const router = useRouter()
  const chores = useChores()
  const [draft, setDraft] = React.useState<ChoreDraft>(initial)
  const [discardOpen, setDiscardOpen] = React.useState(false)
  const dirty = !choreDraftsEqual(draft, initial)
  const returnFocus = useReturnFocus()
  const savingRef = React.useRef(false)

  React.useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [dirty])

  async function save() {
    if (savingRef.current) return
    savingRef.current = true
    const ok = await chores.updateChore(choreId, draftToChoreFields(draft))
    savingRef.current = false
    if (ok) router.push(`/chores/${choreId}?saved=1`)
  }

  function requestClose() {
    if (dirty) {
      returnFocus.capture()
      setDiscardOpen(true)
    } else router.push(`/chores/${choreId}`)
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between gap-2 px-4">
          <Button
            variant="ghost"
            size="icon"
            aria-label="수정 닫기"
            onClick={requestClose}
          >
            <X className="size-5" aria-hidden="true" />
          </Button>
          <p className="text-sm font-medium text-muted-foreground">
            집안일 수정
          </p>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-4 pb-6">
        <Badge
          variant="outline"
          className="h-6 self-start px-2.5 text-muted-foreground"
        >
          프론트 데모 · 실제 저장 및 알림 미연결
        </Badge>
        <h1 className="text-2xl leading-snug font-bold tracking-tight">
          집안일 수정
        </h1>
        <ChoreForm
          formId="chore-edit-form"
          draft={draft}
          family={family}
          onChange={(p) => setDraft((d) => ({ ...d, ...p }))}
          onSubmit={save}
        />
      </main>

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent onCloseAutoFocus={returnFocus.onCloseAutoFocus}>
          <DialogHeader>
            <DialogTitle>변경 내용을 버릴까요?</DialogTitle>
            <DialogDescription>
              저장하지 않은 입력은 사라지고 원래 집안일은 그대로 유지돼요.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardOpen(false)}>
              계속 수정
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setDiscardOpen(false)
                router.push(`/chores/${choreId}`)
              }}
            >
              버리기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <footer className="sticky bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto grid max-w-md grid-cols-2 gap-2 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+--spacing(3))]">
          <Button variant="outline" size="lg" onClick={requestClose}>
            취소
          </Button>
          <Button
            size="lg"
            type="submit"
            form="chore-edit-form"
            disabled={!dirty}
          >
            저장
          </Button>
        </div>
      </footer>
    </div>
  )
}
