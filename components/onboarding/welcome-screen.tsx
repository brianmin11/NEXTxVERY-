"use client"

import Link from "next/link"
import { ShieldCheck } from "lucide-react"

import { PixelCharacter } from "@/components/character/pixel-character"
import { useOnboarding } from "@/components/family/family-provider"
import { BRAND_NAME } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { themeLayerSrc } from "@/lib/scene/themes"

const HERO_CHARACTERS = [
  { skin: "skin2", hair: "bob_brown", outfit: "cardigan", accessory: "ribbon" },
  { skin: "skin4", hair: "sidepart_darkbrown", outfit: "hoodie", accessory: "glasses" },
  { skin: "skin3", hair: "bun_black", outfit: "overalls", accessory: "cap" },
] as const

/**
 * 환영 화면. 새 가족 만들기 / 초대코드로 참여하기.
 * 라이브에서는 로그인한 뒤 가족이 없을 때 도착한다. '로그인 완료'처럼 보이는 문구는 쓰지 않는다.
 */
export function WelcomeScreen() {
  const { mode, currentFamily, logout } = useOnboarding()
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="relative h-[44vh] min-h-72 overflow-hidden rounded-b-[9rem] bg-home-scene">
        {/* eslint-disable-next-line @next/next/no-img-element -- 정적 픽셀 SVG */}
        <img src={themeLayerSrc("sunny-garden", "background")} alt="" aria-hidden="true" className="pixelated absolute inset-0 h-full w-full object-cover object-top" />
        <div aria-hidden="true" className="absolute bottom-10 left-1/2 flex -translate-x-1/2 items-end gap-3">
          {HERO_CHARACTERS.map((c, i) => (
            <PixelCharacter key={i} config={c} name="" size={i === 1 ? 118 : 100} decorative className="drop-shadow-[0_4px_2px_rgb(29_36_29_/_0.25)]" />
          ))}
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-6 pb-[calc(env(safe-area-inset-bottom)+--spacing(6))]">
        <p className="text-sm font-bold text-primary">{BRAND_NAME}</p>
        <h1 className="mt-2 text-3xl leading-tight font-bold tracking-tight">
          함께 사는 마음을
          <br />
          조금 더 가깝게
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          가족의 마음과 일정, 추억과 할 일을
          <br />한 공간에서 나눠요.
        </p>

        <div className="mt-auto flex flex-col gap-2.5 pt-8">
          <Button size="lg" asChild>
            <Link href="/family/new">새 가족 만들기</Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/join">초대코드로 참여하기</Link>
          </Button>
          <p className="flex items-center justify-center gap-1.5 pt-1 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            {mode === "demo" ? "프론트 데모 흐름이에요. 로그인은 아직 연결되지 않았어요." : "초대코드는 참여할 가족을 찾는 코드이고, 로그인은 이미 끝났어요."}
          </p>
          {currentFamily && (
            <Button variant="link" className="h-11" asChild>
              <Link href="/home">지금 가족 ‘{currentFamily.name}’으로 돌아가기</Link>
            </Button>
          )}
          {mode === "live" && logout && (
            <Button variant="ghost" className="h-11 text-muted-foreground" onClick={() => void logout()}>
              다른 계정으로 로그인
            </Button>
          )}
        </div>
      </main>
    </div>
  )
}
