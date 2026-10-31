"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, CalendarDays, SearchX, Trash2, User } from "lucide-react"

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
import { AppShell, DemoBadge } from "@/components/woorijip/app-shell"
import { EmptyState } from "@/components/woorijip/state-views"
import { formatDateKeyFull } from "@/lib/calendar/date"
import { formatDate, formatTime } from "@/lib/format"
import { findMember } from "@/lib/home.fixture"

import { MemoryImage } from "./memory-image"
import { memoryAlt } from "@/components/memories/memories-screen"
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

  const header = (
    <Button
      variant="ghost"
      size="icon"
      aria-label="추억 목록으로 돌아가기"
      onClick={() => router.push("/memories")}
    >
      <ArrowLeft className="size-5" aria-hidden="true" />
    </Button>
  )

  if (!post || !asset) {
    return (
      <AppShell title={header}>
        <DemoBadge />
        <EmptyState
          icon={SearchX}
          title="이 추억을 찾을 수 없어요"
          description="삭제됐거나 접근할 수 없는 사진이에요."
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
    if (!(await mem.removePost(post!.id))) return
    setConfirmOpen(false)
    router.replace("/memories")
  }

  return (
    <AppShell title={header}>
      <DemoBadge />
      <DemoViewerSwitch />

      <figure className="flex flex-col gap-3">
        <div className="max-h-[70dvh] w-full overflow-hidden rounded-xl bg-muted ring-1 ring-border">
          <div
            className="mx-auto max-h-[70dvh]"
            style={{ aspectRatio: `${asset.width} / ${asset.height}` }}
          >
            <MemoryImage asset={asset} alt={alt} fit="contain" />
          </div>
        </div>
        <figcaption className="flex flex-col gap-3">
          <p className="text-lg leading-relaxed whitespace-pre-wrap">
            {post.caption || (
              <span className="text-muted-foreground">설명 없음</span>
            )}
          </p>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-2">
              <dt className="flex w-16 shrink-0 items-center gap-1.5 text-muted-foreground">
                <CalendarDays className="size-4" aria-hidden="true" />
                날짜
              </dt>
              <dd>
                <time dateTime={post.memoryDate}>
                  {formatDateKeyFull(post.memoryDate)}
                </time>
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="flex w-16 shrink-0 items-center gap-1.5 text-muted-foreground">
                <User className="size-4" aria-hidden="true" />
                올린 사람
              </dt>
              <dd className="flex items-center gap-2">
                {author && (
                  <FamilyAvatar member={author} size={28} decorative />
                )}
                {author?.name ?? "가족"}
                <span className="text-muted-foreground tabular-nums">
                  ·{" "}
                  <time dateTime={post.createdAt}>
                    {formatDate(created)} {formatTime(created)}
                  </time>{" "}
                  등록
                </span>
              </dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-1.5">
            {post.seed && (
              <Badge
                variant="outline"
                className="h-6 px-2 text-muted-foreground"
              >
                데모 예시
              </Badge>
            )}
          </div>
        </figcaption>
      </figure>

      <p className="text-sm text-muted-foreground">
        가족 누구나 볼 수 있고,{" "}
        {canDelete
          ? "올린 사람이라서 삭제할 수 있어요"
          : "올린 사람만 삭제할 수 있어요"}{" "}
        .
      </p>
      {canDelete && (
        <Button
          variant="destructive"
          size="lg"
          onClick={() => {
            returnFocus.capture()
            setConfirmOpen(true)
          }}
        >
          <Trash2 aria-hidden="true" />
          추억 삭제
        </Button>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent onCloseAutoFocus={returnFocus.onCloseAutoFocus}>
          <DialogHeader>
            <DialogTitle>이 추억을 삭제할까요?</DialogTitle>
            <DialogDescription>
              {formatDateKeyFull(post.memoryDate)} ·{" "}
              {post.caption || "설명 없음"}. 가족의 추억에서 삭제되며 되돌릴 수
              없어요.
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
