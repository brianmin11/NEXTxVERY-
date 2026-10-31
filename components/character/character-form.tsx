"use client"

import * as React from "react"
import { AlertCircle, Check } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ACCESSORY_OPTIONS,
  HAIR_OPTIONS,
  OUTFIT_OPTIONS,
  SKIN_OPTIONS,
  type AccessoryId,
  type CharacterConfig,
  type HairId,
  type OutfitId,
  type SkinId,
} from "@/lib/character/catalog"
import { MEMBER_NAME_MAX_LENGTH } from "@/lib/family/config"
import { cn } from "@/lib/utils"

import { PixelCharacter } from "./pixel-character"

export type CharacterDraft = { name: string; avatar: CharacterConfig }

type CharacterFormProps = {
  draft: CharacterDraft
  onChange: (patch: Partial<CharacterDraft> | { avatar: Partial<CharacterConfig> }) => void
  nameError?: string | null
  /** 이름 입력을 숨기고 외형만 고른다 */
  hideName?: boolean
}

/**
 * 캐릭터 미리보기 + 이름 + 외형 선택(헤어·의상·피부·소품). 선택은 draft에만 반영되고 저장 전까지 원래 캐릭터는 유지된다.
 * 얼굴은 자산이 1종뿐이라 선택지를 두지 않는다.
 */
export function CharacterForm({ draft, onChange, nameError, hideName = false }: CharacterFormProps) {
  const setAvatar = (patch: Partial<CharacterConfig>) => onChange({ avatar: { ...draft.avatar, ...patch } })
  return (
    <div className="flex flex-col gap-6">
      <div className="relative -mx-4 flex h-72 items-end justify-center overflow-hidden bg-[linear-gradient(var(--home-header-from),var(--secondary))]">
        <span aria-hidden="true" className="absolute bottom-9 left-1/2 h-14 w-56 -translate-x-1/2 rounded-full bg-primary/10" />
        <div className="relative mb-6 flex flex-col items-center gap-1">
          <PixelCharacter config={draft.avatar} name={draft.name || "내 캐릭터"} size={168} />
          <span className="rounded-full border border-card/70 bg-foreground/85 px-2.5 py-0.5 text-xs font-bold text-card">
            {draft.name.trim() || "이름 없음"}
          </span>
        </div>
      </div>

      {!hideName && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="character-name" className="text-sm font-semibold text-muted-foreground">
            이름 <span className="text-destructive" aria-hidden="true">*</span>
            <span className="sr-only"> (필수)</span>
          </Label>
          <Input
            id="character-name"
            value={draft.name}
            maxLength={MEMBER_NAME_MAX_LENGTH}
            autoComplete="nickname"
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? "character-name-error character-name-hint" : "character-name-hint"}
            onChange={(e) => onChange({ name: e.target.value })}
          />
          <div className="flex items-start justify-between gap-3">
            {nameError ? (
              <p id="character-name-error" role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                {nameError}
              </p>
            ) : (
              <span />
            )}
            <p id="character-name-hint" className="shrink-0 text-sm text-muted-foreground tabular-nums">
              {Array.from(draft.name).length} / {MEMBER_NAME_MAX_LENGTH}
            </p>
          </div>
        </div>
      )}

      <OptionGroup label={`헤어 · ${HAIR_OPTIONS.length}종`}>
        {HAIR_OPTIONS.map((o) => (
          <Swatch key={o.id} label={o.label} selected={draft.avatar.hair === o.id} onSelect={() => setAvatar({ hair: o.id as HairId })}>
            <PixelCharacter config={{ ...draft.avatar, hair: o.id }} name={o.label} size={52} decorative />
          </Swatch>
        ))}
      </OptionGroup>

      <OptionGroup label={`의상 · ${OUTFIT_OPTIONS.length}종`}>
        {OUTFIT_OPTIONS.map((o) => (
          <Swatch key={o.id} label={o.label} selected={draft.avatar.outfit === o.id} onSelect={() => setAvatar({ outfit: o.id as OutfitId })}>
            <span aria-hidden="true" className="block size-9 rounded-md" style={{ background: o.swatch }} />
          </Swatch>
        ))}
      </OptionGroup>

      <OptionGroup label={`피부톤 · ${SKIN_OPTIONS.length}종`}>
        {SKIN_OPTIONS.map((o) => (
          <Swatch key={o.id} label={o.label} selected={draft.avatar.skin === o.id} onSelect={() => setAvatar({ skin: o.id as SkinId })}>
            <span aria-hidden="true" className="block size-9 rounded-full" style={{ background: o.swatch }} />
          </Swatch>
        ))}
      </OptionGroup>

      <OptionGroup label={`소품 · ${ACCESSORY_OPTIONS.length - 1}종`}>
        {ACCESSORY_OPTIONS.map((o) => (
          <Swatch
            key={o.id}
            label={o.label}
            selected={draft.avatar.accessory === o.id}
            onSelect={() => setAvatar({ accessory: o.id as AccessoryId })}
            wide
          >
            <span className="text-sm font-medium">{o.label}</span>
          </Swatch>
        ))}
      </OptionGroup>
    </div>
  )
}

function OptionGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">{children}</div>
    </div>
  )
}

function Swatch({
  label,
  selected,
  onSelect,
  children,
  wide = false,
}: {
  label: string
  selected: boolean
  onSelect: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      onClick={onSelect}
      className={cn(
        "relative flex h-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted ring-1 ring-border transition-[box-shadow,background-color] outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/60 active:bg-secondary",
        wide ? "min-w-16 px-3" : "w-16",
        selected && "bg-card ring-2 ring-primary"
      )}
    >
      {children}
      {selected && (
        <span aria-hidden="true" className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-3" strokeWidth={3} />
        </span>
      )}
    </button>
  )
}
