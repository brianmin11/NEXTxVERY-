"use client"

import * as React from "react"
import Link from "next/link"
import { CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/woorijip/state-views"
import type { FamilyView, Schedule } from "@/src/contracts/family"
import { HouseholdSetup } from "./account"
import {
  dateRange,
  fromInputDate,
  memberNames,
  Members,
  PageFrame,
  Panel,
  toInputDate,
  useFamily,
} from "./common"

export type ScheduleFields = {
  title: string
  start: string
  end: string
  participantIds: string[]
}
export function ScheduleFieldsForm({
  view,
  initial,
  busy,
  onSubmit,
  label = "일정 저장",
}: {
  view: FamilyView
  initial?: Schedule
  busy: boolean
  onSubmit: (value: ScheduleFields) => Promise<void>
  label?: string
}) {
  const [title, setTitle] = React.useState(initial?.title || ""),
    [start, setStart] = React.useState(
      initial ? toInputDate(initial.start) : ""
    ),
    [end, setEnd] = React.useState(initial ? toInputDate(initial.end) : ""),
    [participants, setParticipants] = React.useState(
      initial?.participantIds || [view.viewer.id]
    ),
    [error, setError] = React.useState("")
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    if (!participants.length) {
      setError("함께하는 사람을 한 명 이상 선택해 주세요.")
      return
    }
    if (start >= end) {
      setError("종료는 시작보다 뒤여야 해요.")
      return
    }
    await onSubmit({
      title: title.trim(),
      start: fromInputDate(start),
      end: fromInputDate(end),
      participantIds: participants,
    })
  }
  return (
    <form className="flex flex-col gap-4" onSubmit={submit} aria-label={label}>
      <label className="space-y-2">
        일정 이름
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
          disabled={busy}
        />
      </label>
      <label className="space-y-2">
        시작
        <Input
          type="datetime-local"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          required
          disabled={busy}
        />
      </label>
      <label className="space-y-2">
        종료
        <Input
          type="datetime-local"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          required
          disabled={busy}
          aria-invalid={!!error && start >= end}
        />
      </label>
      <p className="text-sm text-muted-foreground">
        날짜와 시간은 한국 시간(Asia/Seoul) 기준이에요.
      </p>
      <Members
        members={view.members}
        selected={participants}
        onChange={setParticipants}
        disabled={busy}
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy} aria-busy={busy}>
        {label}
      </Button>
    </form>
  )
}
export function CalendarScreen() {
  const state = useFamily()
  const view = state.view
  return (
    <PageFrame title="일정" state={state}>
      {view &&
        (!view.household ? (
          <HouseholdSetup state={state} />
        ) : (
          <>
            <Panel
              title="새 일정"
              description="일정을 저장한 뒤 마음 전하기에서 함께 변경을 조율할 수 있어요."
            >
              <ScheduleFieldsForm
                view={view}
                busy={state.busy}
                onSubmit={async (fields) => {
                  await state.run(
                    { type: "schedule.create", ...fields },
                    "일정을 저장했어요."
                  )
                }}
              />
            </Panel>
            <section aria-label="저장된 일정" className="flex flex-col gap-4">
              <h2 className="text-xl font-bold">저장된 일정</h2>
              {!view.schedules.length ? (
                <EmptyState
                  icon={CalendarDays}
                  title="아직 일정이 없어요"
                  description="위에서 우리 가족의 첫 일정을 등록해 보세요."
                />
              ) : (
                view.schedules.map((s) => (
                  <Panel
                    key={s.id}
                    title={s.title}
                    data-testid={`schedule-${s.id}`}
                  >
                    <p className="leading-relaxed">
                      {dateRange(s.start, s.end)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      함께하는 사람: {memberNames(s.participantIds, view)}
                    </p>
                    {s.originPlanId && (
                      <p className="text-sm text-primary">
                        함께 수락한 변경을 반영했어요.
                      </p>
                    )}
                    <Button asChild variant="secondary">
                      <Link href="/home/heart">변경을 함께 조율하기</Link>
                    </Button>
                  </Panel>
                ))
              )}
            </section>
          </>
        ))}
    </PageFrame>
  )
}
