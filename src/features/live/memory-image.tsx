"use client"

import * as React from "react"
import { ImageOff } from "lucide-react"

import type { MemoryAsset } from "@/lib/memories/types"
import { cn } from "@/lib/utils"

type MemoryImageProps = {
  asset: MemoryAsset
  /** 의미 있는 사진의 대체 텍스트(설명이 없으면 날짜·작성자로 만든 문장) */
  alt: string
  /** cover: 목록 타일(비율 맞춰 자름), contain: 상세(원본 전체) */
  fit?: "cover" | "contain"
  className?: string
}

/**
 * 사진 자산 렌더. 로딩(skeleton)·실패(아이콘+문구) 상태를 가진다.
 * next/image를 쓰지 않는 이유: 사진이 서버 경로가 아니라 브라우저 안 object URL(blob:)이라 최적화 로더를 거칠 수 없다.
 * 서버 업로드가 생기면 그때 next/image로 바꾼다.
 */
export function MemoryImage({
  asset,
  alt,
  fit = "cover",
  className,
}: MemoryImageProps) {
  const [state, setState] = React.useState<"loading" | "loaded" | "error">(
    "loading"
  )

  if (asset.kind === "placeholder") {
    return <PlaceholderImage asset={asset} alt={alt} className={className} />
  }

  return (
    <div className={cn("relative h-full w-full bg-muted", className)}>
      {state === "loading" && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-border motion-safe:animate-pulse"
        />
      )}
      {state === "error" ? (
        <div
          role="img"
          aria-label={`${alt} (사진을 불러오지 못했어요)`}
          className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-muted-foreground"
        >
          <ImageOff className="size-6" aria-hidden="true" />
          <span className="text-sm">사진을 불러오지 못했어요</span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- object URL(blob:)은 next/image 로더를 쓸 수 없다
        <img
          src={asset.kind === "remote" ? asset.url : asset.objectUrl}
          alt={alt}
          width={asset.width}
          height={asset.height}
          loading="lazy"
          decoding="async"
          onLoad={() => setState("loaded")}
          onError={() => setState("error")}
          className={cn(
            "h-full w-full",
            fit === "cover" ? "object-cover" : "object-contain",
            state === "loading" && "opacity-0"
          )}
        />
      )}
    </div>
  )
}

const TONE: Record<"apricot" | "sky" | "butter", string> = {
  apricot: "var(--deco-apricot)",
  sky: "var(--deco-sky)",
  butter: "var(--deco-butter)",
}

/** 로컬 합성 플레이스홀더. 실제 사진이 아니며 '예시 이미지'로 표시한다. */
function PlaceholderImage({
  asset,
  alt,
  className,
}: {
  asset: Extract<MemoryAsset, { kind: "placeholder" }>
  alt: string
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={`${alt} (예시 이미지)`}
      className={cn("h-full w-full", className)}
    >
      <rect width="400" height="300" fill={TONE[asset.tone]} opacity="0.55" />
      <circle cx="320" cy="70" r="34" fill="var(--scene-sun)" />
      <path
        d="M0 230C80 190 140 200 200 220C260 240 330 200 400 215V300H0Z"
        fill="var(--scene-grass)"
      />
      <path
        d="M0 262C90 240 170 250 240 265C300 278 350 262 400 255V300H0Z"
        fill="var(--scene-grass-dark)"
        opacity="0.6"
      />
      <g fill="var(--scene-cloud)" opacity="0.95">
        <ellipse cx="110" cy="80" rx="40" ry="16" />
        <circle cx="96" cy="70" r="18" />
        <circle cx="124" cy="66" r="21" />
      </g>
      <rect
        x="120"
        y="128"
        width="160"
        height="30"
        rx="15"
        fill="var(--card)"
        opacity="0.92"
      />
      <text
        x="200"
        y="148"
        textAnchor="middle"
        fontSize="15"
        fontWeight="600"
        fill="var(--foreground)"
      >
        예시 이미지
      </text>
    </svg>
  )
}
