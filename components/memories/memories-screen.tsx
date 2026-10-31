"use client"

import { IS_DEMO } from "@/lib/app-mode"
import Link from "next/link"
import { Camera, ImagePlus, Images } from "lucide-react"

import { useDemoViewer } from "@/components/demo/demo-viewer-provider"
import { DemoViewerSwitch } from "@/components/mind/demo-viewer-switch"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AppShell } from "@/components/woorijip/app-shell"
import { EmptyState } from "@/components/woorijip/state-views"
import { formatDateKey } from "@/lib/calendar/date"
import { findMember } from "@/lib/home.fixture"
import type { MemoryPost } from "@/lib/memories/types"
import { cn } from "@/lib/utils"

import { MemoryImage } from "./memory-image"
import { useMemories } from "./memories-provider"

/** 사진 대체 텍스트: 설명이 있으면 설명, 없으면 날짜·작성자로 만든 문장 */
export function memoryAlt(post: MemoryPost, authorName: string) {
  return post.caption.trim() || `${formatDateKey(post.memoryDate)} ${authorName}이(가) 올린 사진`
}

/** 가족 추억 목록. 첫 장면은 가로로 넓게, 나머지는 정사각 타일. 추억 날짜 내림차순, 같은 날짜는 등록 시각 내림차순. */
export function MemoriesScreen() {
  const { family } = useDemoViewer()
  const { sortedPosts, assetById } = useMemories()

  return (
    <AppShell
      title="추억"
      eyebrow={`${sortedPosts.length}개의 장면`}
      flush
      actions={
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="추억 등록" asChild>
          <Link href="/memories/new">
            <Camera className="size-5" aria-hidden="true" />
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-3 px-4">
        <DemoViewerSwitch />
        {IS_DEMO && (
<p className="text-sm text-muted-foreground">
          이 데모의 사진은 현재 브라우저 탭에서만 보이고 새로고침하면 사라져요. 실제 저장·가족 공유가 아니에요.
        </p>
)}
      </div>

      {sortedPosts.length === 0 ? (
        <div className="px-4">
          <EmptyState
            icon={Images}
            title="아직 추억이 없어요"
            description="첫 사진을 올려 가족과 함께 간직해 보세요."
            action={
              <Button asChild>
                <Link href="/memories/new">
                  <ImagePlus aria-hidden="true" />
                  추억 등록
                </Link>
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-0.5 p-0.5">
          {sortedPosts.map((post, i) => {
            const asset = assetById(post.assetId)
            const author = findMember(family, post.authorId)
            if (!asset || !author) return null
            const alt = memoryAlt(post, author.name)
            const wide = i === 0
            return (
              <li key={post.id} className={cn(wide && "col-span-2")}>
                <Link
                  href={`/memories/${post.id}`}
                  aria-label={`${alt} · 상세 보기`}
                  className={cn(
                    "relative block w-full overflow-hidden bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/70 focus-visible:ring-inset active:opacity-90",
                    wide ? "aspect-[4/3] max-h-72" : "aspect-square"
                  )}
                >
                  <MemoryImage asset={asset} alt="" fit="cover" />
                  <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[60%] bg-[linear-gradient(transparent,rgb(18_21_18/0.72))]" />
                  <span aria-hidden="true" className="pointer-events-none absolute right-3 bottom-3 left-3 flex flex-col gap-0.5 text-left">
                    <span className="line-clamp-1 text-sm font-bold text-white">{post.caption || "설명 없음"}</span>
                    <time className="text-xs text-white/85 tabular-nums" dateTime={post.memoryDate}>
                      {formatDateKey(post.memoryDate)}
                    </time>
                  </span>
                  {post.seed && (
                    <Badge variant="outline" className="absolute top-2 left-2 h-6 bg-card/90 px-2 text-muted-foreground">
                      예시
                    </Badge>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </AppShell>
  )
}
