"use client"

import Link from "next/link"
import { ImagePlus, Images } from "lucide-react"

import { useDemoViewer } from "@/components/demo/demo-viewer-provider"
import { DemoViewerSwitch } from "@/components/mind/demo-viewer-switch"
import { Button } from "@/components/ui/button"
import { AppShell, DemoBadge } from "@/components/woorijip/app-shell"
import { PhotoCard } from "@/components/woorijip/photo-card"
import { EmptyState } from "@/components/woorijip/state-views"
import { formatDateKey } from "@/lib/calendar/date"
import { findMember } from "@/lib/home.fixture"
import type { MemoryPost } from "@/lib/memories/types"

import { MemoryImage } from "./memory-image"
import { useMemories } from "./memories-provider"

/** 사진 대체 텍스트: 설명이 있으면 설명, 없으면 날짜·작성자로 만든 문장 */
export function memoryAlt(post: MemoryPost, authorName: string) {
  return post.caption.trim() || `${formatDateKey(post.memoryDate)} ${authorName}이(가) 올린 사진`
}

/** 가족 추억 목록(2열). 추억 날짜 내림차순, 같은 날짜는 등록 시각 내림차순. */
export function MemoriesScreen() {
  const { family } = useDemoViewer()
  const { sortedPosts, assetById } = useMemories()

  return (
    <AppShell
      title={<h1 className="text-lg font-bold">가족 추억</h1>}
      actions={
        <Button variant="ghost" asChild>
          <Link href="/memories/new">
            <ImagePlus aria-hidden="true" />
            추억 등록
          </Link>
        </Button>
      }
    >
      <DemoBadge />
      <DemoViewerSwitch />
      <p className="text-sm text-muted-foreground">
        이 데모의 사진은 현재 브라우저 탭에서만 보이고 새로고침하면 사라져요. 실제 저장·가족 공유가 아니에요.
      </p>

      {sortedPosts.length === 0 ? (
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
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {sortedPosts.map((post) => {
            const asset = assetById(post.assetId)
            const author = findMember(family, post.authorId)
            if (!asset || !author) return null
            const alt = memoryAlt(post, author.name)
            return (
              <li key={post.id}>
                <Link
                  href={`/memories/${post.id}`}
                  aria-label={`${alt} · 상세 보기`}
                  className="block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:opacity-90"
                >
                  <PhotoCard
                    caption={post.caption || "설명 없음"}
                    dateLabel={formatDateKey(post.memoryDate)}
                    dateTime={post.memoryDate}
                    uploader={author}
                    media={<MemoryImage asset={asset} alt="" fit="cover" />}
                    aspect="square"
                    badge={post.seed ? "예시" : undefined}
                  />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </AppShell>
  )
}
