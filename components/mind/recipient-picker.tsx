"use client"

import { Check } from "lucide-react"

import { FamilyAvatar } from "@/components/home/family-avatar"
import { Button } from "@/components/ui/button"
import type { FamilyMember } from "@/lib/home.fixture"

type RecipientPickerProps = {
  members: FamilyMember[]
  /** 선택 목록에서 제외(자기 자신) */
  excludeId: string
  value: string | null
  onChange: (id: string) => void
  describedBy?: string
}

/** 받는 사람 선택. 라디오 그룹 의미를 주고 선택 상태는 체크 아이콘 + 색으로 함께 표시한다. */
export function RecipientPicker({ members, excludeId, value, onChange, describedBy }: RecipientPickerProps) {
  const options = members.filter((m) => m.id !== excludeId)
  return (
    <div role="radiogroup" aria-label="받는 사람" aria-describedby={describedBy} className="flex flex-wrap gap-2">
      {options.map((m) => {
        const selected = m.id === value
        return (
          <Button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={selected}
            variant={selected ? "secondary" : "outline"}
            className="h-11 gap-2 rounded-full pr-4 pl-2"
            onClick={() => onChange(m.id)}
          >
            <FamilyAvatar member={m} size={30} decorative />
            {m.name}
            {selected && <Check className="size-4 text-primary" aria-hidden="true" />}
          </Button>
        )
      })}
    </div>
  )
}
