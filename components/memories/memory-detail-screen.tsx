"use client"

import { IS_DEMO } from "@/lib/app-mode"
import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { SearchX, Trash2 } from "lucide-react"

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
import { formatDate, formatTime } from "@/lib/format"
import { findMember } from "@/lib/home.fixture"

import { MemoryImage } from "./memory-image"
import { memoryAlt } from "./memories-screen"
import { useMemories } from "./memories-provider"

/** 추억 상세. 원본 비율 전체를 보여주고, 작성자(데모 인물 기준)만 삭제할 수 있다. */
export function MemoryDetailScreen({ id }: { id: string }) {
  const router = useRouter()
  const { family, viewerId } = useDemoViewer()
  const mem = useMemories()
  const post = mem.postById(id)
  const asset = post ? mem.assetById(post.assetId) : undefined
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const returnFocus = useReturnFocus()

  if (!post || !asset) {
    return (
      <AppShell title="추억" back="/memories" backLabel="추억 목록으로 돌아가기">
        <EmptyState
          icon={SearchX}
          title="이 추억을 찾을 수 없어요"
          description="삭제됐거나, 새로고침으로 데모 사진이 사라졌을 수 있어요."
          action={
            <Button asChild>
              <Link href="/memories">목록으로</Link>
            </Button>
          }
        />
      </AppShell>
    )
  }

  const author = findMember(family, post.authorId)
  const canDelete = post.authorId === viewerId
  const alt = memoryAlt(post, author?.name ?? "가족")
  const created = new Date(post.createdAt)

  async function confirmDelete() {
    const ok = await mem.removePost(post!.id)
    setConfirmOpen(false)
    if (ok) router.replace("/memories")
  }

  return (
    <AppShell title="추억" back="/memories" backLabel="추억 목록으로 돌아가기" mainClassName="gap-4">
      <DemoViewerSwitch />

      <figure className="flex flex-col gap-4">
        <div className="-mx-4 max-h-[52dvh] overflow-hidden bg-foreground">
          <div className="mx-auto max-h-[52dvh]" style={{ aspectRatio: `${asset.width} / ${asset.height}` }}>
            <MemoryImage asset={asset} alt={alt} fit="contain" />
          </div>
        </div>
        <figcaption className="flex flex-col gap-2">
          <time className="text-xs text-muted-foreground tabular-nums" dateTime={post.memoryDate}>
            {formatDateKeyFull(post.memoryDate)}
          </time>
          <h1 className="text-xl leading-snug font-bold tracking-tight whitespace-pre-wrap">
            {post.caption || <span className="font-medium text-muted-foreground">설명 없음</span>}
          </h1>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              {author && <FamilyAvatar member={author} size={24} decorative />}
              {author?.name ?? "가족"} 님이 남긴 추억
            </span>
            <span aria-hidden="true">·</span>
            <time dateTime={post.createdAt} className="tabular-nums">
              {formatDate(created)} {formatTime(created)} 등록
            </time>
          </p>
          {post.seed && (
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="h-6 px-2 text-muted-foreground">
                데모 예시
              </Badge>
            </div>
          )}
        </figcaption>
      </figure>

      <p className="text-sm text-muted-foreground">
        가족 누구나 볼 수 있고, {canDelete ? "올린 사람이라서 삭제할 수 있어요" : "올린 사람만 삭제할 수 있어요"}{IS_DEMO ? " (프론트 데모 규칙)" : ""}.
      </p>
      {canDelete && (
        <Button
          variant="ghost"
          className="h-11 self-start px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => {
            returnFocus.capture()
            setConfirmOpen(true)
          }}
        >
          <Trash2 aria-hidden="true" />
          삭제
        </Button>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent onCloseAutoFocus={returnFocus.onCloseAutoFocus}>
          <DialogHeader>
            <DialogTitle>이 추억을 삭제할까요?</DialogTitle>
            <DialogDescription>
              {formatDateKeyFull(post.memoryDate)} · {post.caption || "설명 없음"}. 데모에서만 지워지고 되돌릴 수 없어요.
            </DialogDescription>
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
