"use client"

import * as React from "react"
import { AlertCircle, Check } from "lucide-react"

import { FamilyAvatar } from "@/components/home/family-avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { CALENDAR_LOCATION_MAX, CALENDAR_MEMO_MAX, CALENDAR_TITLE_MAX } from "@/lib/calendar/config"
import {
  CALENDAR_CATEGORIES,
  CALENDAR_CATEGORY_LABEL,
  type CalendarCategory,
  type CalendarDraft,
  type CalendarDraftErrors,
} from "@/lib/calendar/types"
import { draftsEqual, hasErrors, validateDraft } from "@/lib/calendar/validate"
import type { Family } from "@/lib/home.fixture"

type EventFormProps = {
  formId: string
  mode: "create" | "edit"
  initial: CalendarDraft
  family: Family
  /** 검증을 통과했을 때만 호출. token은 연타 중복 방지용 */
  onSubmit: (draft: CalendarDraft, token: string) => void
  /** 입력이 바뀔 때 알림(유실 확인용). 이벤트 핸들러에서만 호출한다 */
  onDirtyChange: (dirty: boolean) => void
}

/** 일정 추가·수정 폼 본문. 저장 버튼은 화면이 `form={formId}`로 그린다. 저장 전에는 원래 일정을 바꾸지 않는다. */
export function EventForm({ formId, mode, initial, family, onSubmit, onDirtyChange }: EventFormProps) {
  const [draft, setDraft] = React.useState<CalendarDraft>(initial)
  const [errors, setErrors] = React.useState<CalendarDraftErrors>({})
  const [submitted, setSubmitted] = React.useState(false)
  // 폼이 열릴 때 한 번 발급. 같은 토큰으로는 provider가 한 번만 추가한다.
  const [token] = React.useState(() => crypto.randomUUID())

  function patch(p: Partial<CalendarDraft>) {
    const next = { ...draft, ...p }
    setDraft(next)
    onDirtyChange(!draftsEqual(next, initial))
    // 고친 필드의 오류는 바로 지운다
    const touched = Object.keys(p) as (keyof CalendarDraft)[]
    if (touched.some((k) => k in errors)) {
      const rest = { ...errors }
      for (const k of touched) delete rest[k as keyof CalendarDraftErrors]
      setErrors(rest)
    }
  }

  function toggleParticipant(id: string) {
    const has = draft.participantIds.includes(id)
    patch({ participantIds: has ? draft.participantIds.filter((x) => x !== id) : [...draft.participantIds, id] })
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (submitted) return
    const next = validateDraft(draft)
    setErrors(next)
    if (hasErrors(next)) {
      const first = Object.keys(next)[0]
      document.getElementById(`ev-${first}`)?.focus()
      return
    }
    setSubmitted(true)
    onSubmit(draft, token)
  }

  const err = (k: keyof CalendarDraftErrors) => errors[k]

  return (
    <form id={formId} onSubmit={submit} noValidate aria-label={mode === "create" ? "일정 추가" : "일정 수정"} className="flex flex-col gap-5">
      <Field id="ev-title" label="제목" required error={err("title")} hint={`${draft.title.length} / ${CALENDAR_TITLE_MAX}`}>
        <Input
          id="ev-title"
          value={draft.title}
          maxLength={CALENDAR_TITLE_MAX}
          placeholder="예: 주말 가족 나들이"
          aria-invalid={!!err("title") || undefined}
          aria-describedby={describedBy("ev-title", !!err("title"))}
          onChange={(e) => patch({ title: e.target.value })}
        />
      </Field>

      <Field id="ev-date" label="날짜" required error={err("date")}>
        <Input
          id="ev-date"
          type="date"
          value={draft.date}
          aria-invalid={!!err("date") || undefined}
          aria-describedby={describedBy("ev-date", !!err("date"))}
          onChange={(e) => patch({ date: e.target.value })}
        />
      </Field>

      <div className="flex min-h-11 items-center justify-between gap-3">
        <Label htmlFor="ev-allDay" className="text-sm font-semibold text-muted-foreground">
          종일
        </Label>
        <Switch id="ev-allDay" checked={draft.allDay} onCheckedChange={(v) => patch({ allDay: v })} />
      </div>

      {!draft.allDay && (
        <div className="grid grid-cols-2 gap-3">
          <Field id="ev-startTime" label="시작" required error={err("startTime")}>
            <Input
              id="ev-startTime"
              type="time"
              value={draft.startTime}
              aria-invalid={!!err("startTime") || undefined}
              aria-describedby={describedBy("ev-startTime", !!err("startTime"))}
              onChange={(e) => patch({ startTime: e.target.value })}
            />
          </Field>
          <Field id="ev-endTime" label="종료" required error={err("endTime")}>
            <Input
              id="ev-endTime"
              type="time"
              value={draft.endTime}
              aria-invalid={!!err("endTime") || undefined}
              aria-describedby={describedBy("ev-endTime", !!err("endTime"))}
              onChange={(e) => patch({ endTime: e.target.value })}
            />
          </Field>
        </div>
      )}

      <Field id="ev-category" label="유형">
        <Select value={draft.category} onValueChange={(v) => patch({ category: v as CalendarCategory })}>
          <SelectTrigger id="ev-category" className="h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CALENDAR_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {CALENDAR_CATEGORY_LABEL[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold text-muted-foreground">참여하는 가족</legend>
        <div className="flex flex-wrap gap-2">
          {family.members.map((m) => {
            const on = draft.participantIds.includes(m.id)
            return (
              <Button
                key={m.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                variant={on ? "secondary" : "outline"}
                className="h-11 gap-2 rounded-full pr-4 pl-2"
                onClick={() => toggleParticipant(m.id)}
              >
                <FamilyAvatar member={m} size={30} decorative />
                {m.name}
                {on && <Check className="size-4 text-primary" aria-hidden="true" />}
              </Button>
            )
          })}
        </div>
      </fieldset>

      <Field id="ev-location" label="장소" error={err("location")} hint={`${draft.location.length} / ${CALENDAR_LOCATION_MAX}`}>
        <Input
          id="ev-location"
          value={draft.location}
          maxLength={CALENDAR_LOCATION_MAX}
          placeholder="선택"
          aria-invalid={!!err("location") || undefined}
          onChange={(e) => patch({ location: e.target.value })}
        />
      </Field>

      <Field id="ev-memo" label="메모" error={err("memo")} hint={`${draft.memo.length} / ${CALENDAR_MEMO_MAX}`}>
        <Textarea
          id="ev-memo"
          value={draft.memo}
          maxLength={CALENDAR_MEMO_MAX}
          rows={3}
          className="min-h-20"
          placeholder="선택"
          aria-invalid={!!err("memo") || undefined}
          onChange={(e) => patch({ memo: e.target.value })}
        />
      </Field>
    </form>
  )
}

function describedBy(id: string, hasError: boolean) {
  return [hasError ? `${id}-error` : null, `${id}-hint`].filter(Boolean).join(" ") || undefined
}

function Field({
  id,
  label,
  required,
  error,
  hint,
  children,
}: {
  id: string
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-sm font-semibold text-muted-foreground">
        {label}
        {required && (
          <span className="text-destructive" aria-hidden="true">
            {" "}
            *
          </span>
        )}
        {required && <span className="sr-only"> (필수)</span>}
      </Label>
      {children}
      <div className="flex items-start justify-between gap-3">
        {error ? (
          <p id={`${id}-error`} role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        ) : (
          <span />
        )}
        {hint && (
          <p id={`${id}-hint`} className="shrink-0 text-sm text-muted-foreground tabular-nums">
            {hint}
          </p>
        )}
      </div>
    </div>
  )
}
