"use client"

import * as React from "react"

import { PixelCharacter } from "@/components/character/pixel-character"
import { FamilyAvatar } from "@/components/home/family-avatar"
import { HouseStagePreview } from "@/components/home/house-stage-preview"
import { HOUSE_STAGE_LABELS, type HouseStage } from "@/components/home/house-layers"
import { PixelScene } from "@/components/home/pixel-scene"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ACCESSORY_OPTIONS, HAIR_OPTIONS, OUTFIT_OPTIONS, SKIN_OPTIONS, type CharacterConfig } from "@/lib/character/catalog"
import { DEMO_FAMILY_EIGHT, DEMO_FAMILY_FOUR, DEMO_FAMILY_ONE, memberRoleLabel, type Family } from "@/lib/home.fixture"
import { SCENE_THEMES, type SceneTheme } from "@/lib/scene/themes"
import { defaultSpot, type SceneSpot } from "@/lib/scene/spots"

const FAMILIES: Record<string, Family> = {
  one: DEMO_FAMILY_ONE,
  four: DEMO_FAMILY_FOUR,
  eight: DEMO_FAMILY_EIGHT,
}

const STAGES: HouseStage[] = [1, 2, 3, 4, 5]

/**
 * 개발 전용 미리보기: 픽셀 테마 5종과 1·4·8명 배치, 캐릭터 레이어 카탈로그, 예전 집 성장 단계 시안.
 * 성장 단계는 정책이 아니라 시각 시안이며 사용자 홈에는 쓰지 않는다.
 */
export function HousePreview() {
  const [theme, setTheme] = React.useState<SceneTheme>("sunny-garden")
  const [familyKey, setFamilyKey] = React.useState<keyof typeof FAMILIES>("four")
  const [stage, setStage] = React.useState<HouseStage>(3)
  const [picked, setPicked] = React.useState<string | null>(null)
  const [spots, setSpots] = React.useState<Record<string, SceneSpot>>({})
  const family = FAMILIES[familyKey]
  const viewerId = family.members[0].id
  const pickedMember = picked ? family.members.find((m) => m.id === picked) : undefined

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Tabs value={theme} onValueChange={(v) => setTheme(v as SceneTheme)}>
          <TabsList aria-label="테마" className="w-full">
            {SCENE_THEMES.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="flex-1 px-1 text-xs">
                {t.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Tabs value={familyKey} onValueChange={(v) => { setFamilyKey(v as keyof typeof FAMILIES); setPicked(null); setSpots({}) }}>
          <TabsList aria-label="가족 인원" className="w-full">
            <TabsTrigger value="one" className="flex-1">1명</TabsTrigger>
            <TabsTrigger value="four" className="flex-1">4명</TabsTrigger>
            <TabsTrigger value="eight" className="flex-1">8명</TabsTrigger>
          </TabsList>
        </Tabs>
        <PixelScene
          family={family}
          theme={theme}
          viewerId={viewerId}
          spotOf={(id) => spots[id] ?? defaultSpot(family.members.findIndex((m) => m.id === id), family.members.length)}
          onMove={(id, spot) => setSpots((s) => ({ ...s, [id]: spot }))}
          onMemberSelect={(id) => setPicked(id)}
          className="-mx-4"
        />
        <p aria-live="polite" className="min-h-6 text-sm">
          {pickedMember ? `선택: ${pickedMember.name} · ${memberRoleLabel(family, pickedMember)}` : "캐릭터를 눌러 보거나 끌어서 옮겨 보세요."}
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

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground">캐릭터 레이어 카탈로그(실제 자산이 있는 항목만)</h3>
        <CatalogRow label={`피부 ${SKIN_OPTIONS.length}`} items={SKIN_OPTIONS.map((o) => ({ label: o.label, config: { skin: o.id, hair: "short_black", outfit: "sweater", accessory: "none" } }))} />
        <CatalogRow label={`헤어 ${HAIR_OPTIONS.length}`} items={HAIR_OPTIONS.map((o) => ({ label: o.label, config: { skin: "skin2", hair: o.id, outfit: "sweater", accessory: "none" } }))} />
        <CatalogRow label={`의상 ${OUTFIT_OPTIONS.length}`} items={OUTFIT_OPTIONS.map((o) => ({ label: o.label, config: { skin: "skin2", hair: "short_black", outfit: o.id, accessory: "none" } }))} />
        <CatalogRow label={`소품 ${ACCESSORY_OPTIONS.length}`} items={ACCESSORY_OPTIONS.map((o) => ({ label: o.label, config: { skin: "skin2", hair: "short_black", outfit: "sweater", accessory: o.id } }))} />
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-muted-foreground">예전 집 성장 단계 시안(미리보기 전용, 사용자 홈 미사용)</h3>
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
          {stage}단계 · {HOUSE_STAGE_LABELS[stage]} — 시안이며 확정 정책이 아니에요. 테마와 합치지 않아요.
        </p>
        <HouseStagePreview stage={stage} className="aspect-[5/3] w-full rounded-xl bg-scene-sky" />
      </div>
    </div>
  )
}

function CatalogRow({ label, items }: { label: string; items: { label: string; config: CharacterConfig }[] }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {items.map((it) => (
          <li key={it.label} className="flex w-16 shrink-0 flex-col items-center gap-1 rounded-lg bg-card p-1 ring-1 ring-border">
            <PixelCharacter config={it.config} name={it.label} size={56} />
            <span className="w-full truncate text-center text-xs text-muted-foreground">{it.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
