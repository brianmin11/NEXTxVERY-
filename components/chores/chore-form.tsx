"use client"

import * as React from "react"
import { AlertCircle } from "lucide-react"

import { RecipientPicker } from "@/components/mind/recipient-picker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CHORE_MEMO_MAX, CHORE_TITLE_MAX } from "@/lib/chores/config"
import type { ChoreDraft, ChoreDraftErrors } from "@/lib/chores/types"
import { hasChoreErrors, validateChoreDraft } from "@/lib/chores/validate"
import type { Family } from "@/lib/home.fixture"

type ChoreFormProps = {
  draft: ChoreDraft
  family: Family
  onChange: (patch: Partial<ChoreDraft>) => void
  /** 검증을 통과했을 때만 호출 */
  onSubmit: () => void
  formId: string
}

/** 추가·수정 공용 폼 본문. 오류는 필드 근처에 표시하고 첫 오류 필드로 포커스를 옮긴다. */
export function ChoreForm({ draft, family, onChange, onSubmit, formId }: ChoreFormProps) {
  const [errors, setErrors] = React.useState<ChoreDraftErrors>({})

  function patch(p: Partial<ChoreDraft>) {
    onChange(p)
    const keys = Object.keys(p) as (keyof ChoreDraft)[]
    if (keys.some((k) => k in errors)) {
      const rest = { ...errors }
      for (const k of keys) delete rest[k]
      setErrors(rest)
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const next = validateChoreDraft(draft, family.members.map((m) => m.id))
    setErrors(next)
    if (hasChoreErrors(next)) {
      const first = Object.keys(next)[0] as keyof ChoreDraft
      const target = first === "assigneeMemberId" ? document.querySelector<HTMLElement>("#chore-assignee [role=radio]") : document.getElementById(`chore-${first}`)
      target?.focus()
      return
    }
    onSubmit()
  }

  const err = (k: keyof ChoreDraft) => errors[k]

  return (
    <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="chore-title" className="text-sm font-semibold text-muted-foreground">
          할 일 <span className="text-destructive" aria-hidden="true">*</span>
          <span className="sr-only"> (필수)</span>
        </Label>
        <Input
          id="chore-title"
          value={draft.title}
          maxLength={CHORE_TITLE_MAX}
          placeholder="예: 설거지"
          aria-invalid={!!err("title") || undefined}
          aria-describedby={err("title") ? "chore-title-error chore-title-hint" : "chore-title-hint"}
          onChange={(e) => patch({ title: e.target.value })}
        />
        <div className="flex items-start justify-between gap-3">
          {err("title") ? (
            <p id="chore-title-error" role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              {err("title")}
            </p>
          ) : (
            <span />
          )}
          <p id="chore-title-hint" className="shrink-0 text-sm text-muted-foreground tabular-nums">
            {draft.title.length} / {CHORE_TITLE_MAX}
          </p>
        </div>
      </div>

      <div id="chore-assignee" className="flex flex-col gap-1.5">
        <p className="text-sm font-semibold text-muted-foreground">
          담당 <span className="text-destructive" aria-hidden="true">*</span>
          <span className="sr-only"> (필수)</span>
        </p>
        <RecipientPicker
          label="담당할 가족"
          members={family.members}
          excludeId=""
          value={draft.assigneeMemberId || null}
          onChange={(id) => patch({ assigneeMemberId: id })}
          describedBy={err("assigneeMemberId") ? "chore-assignee-error" : "chore-assignee-hint"}
        />
        {err("assigneeMemberId") ? (
          <p id="chore-assignee-error" role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            {err("assigneeMemberId")}
          </p>
        ) : (
          <p id="chore-assignee-hint" className="text-sm text-muted-foreground">
            담당자를 정해도 그 사람이 수락한 건 아니에요. 수락·알림은 아직 없어요.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="chore-dueDate" className="text-sm font-semibold text-muted-foreground">
          날짜 (선택)
        </Label>
        <div className="flex gap-2">
          <Input
            id="chore-dueDate"
            type="date"
            value={draft.dueDate}
            aria-invalid={!!err("dueDate") || undefined}
            aria-describedby={err("dueDate") ? "chore-dueDate-error" : "chore-dueDate-hint"}
            onChange={(e) => patch({ dueDate: e.target.value })}
          />
          {draft.dueDate && (
            <Button type="button" variant="outline" onClick={() => patch({ dueDate: "" })}>
              날짜 미정
            </Button>
          )}
        </div>
        {err("dueDate") ? (
          <p id="chore-dueDate-error" role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            {err("dueDate")}
          </p>
        ) : (
          <p id="chore-dueDate-hint" className="text-sm text-muted-foreground">
            비워 두면 ‘날짜 미정’으로 표시돼요. 시간은 붙이지 않아요.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="chore-memo" className="text-sm font-semibold text-muted-foreground">
          메모 (선택)
        </Label>
        <Textarea
          id="chore-memo"
          value={draft.memo}
          maxLength={CHORE_MEMO_MAX}
          rows={3}
          className="min-h-20"
          placeholder="예: 저녁 먹고 나서 바로"
          aria-invalid={!!err("memo") || undefined}
          aria-describedby={err("memo") ? "chore-memo-error chore-memo-hint" : "chore-memo-hint"}
          onChange={(e) => patch({ memo: e.target.value })}
        />
        <div className="flex items-start justify-between gap-3">
          {err("memo") ? (
            <p id="chore-memo-error" role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              {err("memo")}
            </p>
          ) : (
            <span />
          )}
          <p id="chore-memo-hint" className="shrink-0 text-sm text-muted-foreground tabular-nums">
            {draft.memo.length} / {CHORE_MEMO_MAX}
          </p>
        </div>
      </div>
    </form>
  )
}
