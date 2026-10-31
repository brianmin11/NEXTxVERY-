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
 * `<img>`를 쓰는 이유: 데모의 object URL(blob:)은 next/image 로더를 거칠 수 없고,
 * 라이브의 사진 URL(`/api/v2/memories/assets/:id/content`)은 로그인 쿠키로 권한을 검사하는 비공개 경로라 최적화 프록시를 거치지 않는다.
 */
export function MemoryImage({ asset, alt, fit = "cover", className }: MemoryImageProps) {
  const [state, setState] = React.useState<"loading" | "loaded" | "error">("loading")

  if (asset.kind === "placeholder") {
    return <PlaceholderImage asset={asset} alt={alt} className={className} />
  }

  const src = asset.kind === "remote" ? asset.url : asset.objectUrl
  return (
    <div className={cn("relative h-full w-full bg-muted", className)}>
      {state === "loading" && <div aria-hidden="true" className="absolute inset-0 bg-border motion-safe:animate-pulse" />}
      {state === "error" ? (
        <div role="img" aria-label={`${alt} (사진을 불러오지 못했어요)`} className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-muted-foreground">
          <ImageOff className="size-6" aria-hidden="true" />
          <span className="text-sm">사진을 불러오지 못했어요</span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- blob URL과 권한 검사 경로는 next/image 로더를 쓸 수 없다
        <img
          src={src}
          alt={alt}
          width={asset.width}
          height={asset.height}
          loading="lazy"
          decoding="async"
          onLoad={() => setState("loaded")}
          onError={() => setState("error")}
          className={cn("h-full w-full", fit === "cover" ? "object-cover" : "object-contain", state === "loading" && "opacity-0")}
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

/** 데모 seed용 합성 '예시 이미지'. 프로젝트에 사진 자산이 없어 SVG로 그린다. */
function PlaceholderImage({ asset, alt, className }: { asset: Extract<MemoryAsset, { kind: "placeholder" }>; alt: string; className?: string }) {
  const fill = TONE[asset.tone]
  return (
    <svg
      viewBox="0 0 400 300"
      role="img"
      aria-label={`${alt} (예시 이미지)`}
      className={cn("h-full w-full", className)}
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="400" height="300" fill={fill} />
      <ellipse cx="300" cy="80" rx="40" ry="40" fill="var(--deco-butter)" opacity="0.9" />
      <path d="M0 220 Q 120 160 220 220 T 400 210 L 400 300 L 0 300 Z" fill="var(--scene-grass)" />
      <path d="M0 250 Q 140 200 260 250 T 400 240 L 400 300 L 0 300 Z" fill="var(--scene-grass-dark)" />
      <g fill="var(--scene-cloud)">
        <ellipse cx="110" cy="90" rx="38" ry="18" />
        <ellipse cx="130" cy="78" rx="28" ry="16" />
        <ellipse cx="88" cy="82" rx="22" ry="14" />
      </g>
      <text x="200" y="160" textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--foreground)" opacity="0.75" fontFamily="inherit">
        {asset.label}
      </text>
    </svg>
  )
}
