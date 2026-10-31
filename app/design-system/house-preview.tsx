"use client"

import * as React from "react"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FamilyAvatar } from "@/components/home/family-avatar"
import { FamilyHouseScene } from "@/components/home/family-house-scene"
import { HOUSE_STAGE_LABELS } from "@/components/home/house-layers"
import {
  DEMO_FAMILY_EIGHT,
  DEMO_FAMILY_FOUR,
  DEMO_FAMILY_ONE,
  type Family,
  type HouseStage,
} from "@/lib/home.fixture"

const FAMILIES: Record<string, Family> = {
  one: DEMO_FAMILY_ONE,
  four: DEMO_FAMILY_FOUR,
  eight: DEMO_FAMILY_EIGHT,
}

const STAGES: HouseStage[] = [1, 2, 3, 4, 5]

/**
 * 개발 전용 미리보기: 집 5단계 시안과 1·4·8명 배치를 바꿔 본다.
 * 성장 정책이 아니라 시각 시안 확인용이다. 실제 홈은 기본 장면 하나만 보여준다.
 */
export function HousePreview() {
  const [stage, setStage] = React.useState<HouseStage>(3)
  const [familyKey, setFamilyKey] = React.useState<keyof typeof FAMILIES>("four")
  const [picked, setPicked] = React.useState<string | null>(null)
  const family = FAMILIES[familyKey]
  const pickedMember = picked ? family.members.find((m) => m.id === picked) : undefined

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={String(stage)} onValueChange={(v) => setStage(Number(v) as HouseStage)}>
        <TabsList aria-label="집 단계 시안" className="w-full">
          {STAGES.map((s) => (
            <TabsTrigger key={s} value={String(s)} className="flex-1">
              {s}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <p className="text-sm text-muted-foreground">
        {stage}단계 · {HOUSE_STAGE_LABELS[stage]} — 시안이며 확정 정책이 아니에요.
      </p>
      <Tabs value={familyKey} onValueChange={(v) => { setFamilyKey(v as keyof typeof FAMILIES); setPicked(null) }}>
        <TabsList aria-label="가족 인원" className="w-full">
          <TabsTrigger value="one" className="flex-1">1명</TabsTrigger>
          <TabsTrigger value="four" className="flex-1">4명</TabsTrigger>
          <TabsTrigger value="eight" className="flex-1">8명</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="px-4">
        <FamilyHouseScene
          family={family}
          stage={stage}
          onMemberSelect={setPicked}
          onMoreSelect={() => setPicked("__more")}
        />
      </div>
      <p aria-live="polite" className="min-h-6 text-sm">
        {picked === "__more"
          ? `+N 버튼: 가족 ${family.members.length}명 전체 목록 시트가 열려요(홈에서 확인).`
          : pickedMember
            ? `선택: ${pickedMember.name} · ${pickedMember.role ?? "구성원"}`
            : "캐릭터나 +N을 눌러 보세요."}
      </p>
      <div className="flex flex-wrap items-end gap-3 rounded-xl bg-card p-4 ring-1 ring-border">
        {family.members.map((m) => (
          <div key={m.id} className="flex w-16 flex-col items-center gap-1">
            <FamilyAvatar member={m} size={56} />
            <span className="w-full truncate text-center text-xs text-muted-foreground">{m.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
