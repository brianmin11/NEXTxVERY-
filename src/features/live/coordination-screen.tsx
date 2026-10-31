"use client"

import * as React from "react"
import Link from "next/link"
import { AppShell } from "@/components/woorijip/app-shell"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  CoordinationPreview,
  CoordinationProposal,
  CoordinationRoom,
} from "@/src/contracts/coordination"
import { api, ResourceState, useResource } from "./client"
import { useFamily as useDemoViewer } from "@/components/family/family-context"
import { useCalendar } from "@/components/calendar/calendar-context"

const statusText: Record<CoordinationRoom["status"], string> = {
  open: "의견 나누는 중",
  proposed: "수락 기다리는 중",
  deferred: "보류 중",
  declined: "거절로 마침",
  applied: "일정에 반영됨",
  withdrawn: "동의가 철회됨",
}
const decisionText = { accept: "수락", defer: "보류", decline: "거절" }

export function CoordinationScreen() {
  const { viewerId, family } = useDemoViewer()
  const rooms = useResource<CoordinationRoom[]>("coordinations", [])
  const events = useCalendar()
  const [eventId, setEventId] = React.useState("")
  const [roomId, setRoomId] = React.useState("")
  const eligible = events.events.filter(
    (event) =>
      !event.allDay &&
      event.startTime &&
      event.endTime &&
      event.createdByMemberId === viewerId &&
      new Set([viewerId, ...event.participantIds]).size >= 2
  )
  const room = rooms.data.find((item) => item.id === roomId)
  const selectedEvent = eligible.find((event) => event.id === eventId)
  async function refresh() {
    await Promise.all([rooms.refresh(), events.refresh()])
  }
  async function create() {
    if (!selectedEvent) return
    const result = await rooms.mutate<CoordinationRoom>(
      "coordinations",
      "POST",
      {
        eventId: selectedEvent.id,
        expectedEventRevision: selectedEvent.revision,
      }
    )
    if (result) setRoomId(result.id)
  }
  async function mutate(action: string, body: Record<string, unknown>) {
    if (!room) return false
    const result = await rooms.mutate<CoordinationRoom>(
      `coordinations/${room.id}/${action}`,
      "POST",
      {
        ...body,
        expectedRevision: room.revision,
      }
    )
    if (result && action === "apply") await events.refresh()
    return !!result
  }
  return (
    <AppShell
      title={<h1 className="text-lg font-bold">일정 함께 조율하기</h1>}
      actions={
        <Button
          variant="ghost"
          disabled={rooms.busy}
          onClick={() => void refresh()}
        >
          새로고침
        </Button>
      }
    >
      <p className="text-sm text-muted-foreground">
        가족이 같은 제안을 모두 수락하면 일정 작성자가 반영할 수 있어요.
      </p>
      <ResourceState
        loading={rooms.loading || events.loading}
        error={rooms.error || events.error || ""}
        busy={rooms.busy}
        retry={refresh}
      >
        <section
          className="flex flex-col gap-3"
          aria-labelledby="coordination-create-title"
        >
          <h2 id="coordination-create-title" className="font-semibold">
            새 조율 시작하기
          </h2>
          {eligible.length ? (
            <>
              <label
                htmlFor="coordination-event"
                className="text-sm font-medium"
              >
                조율할 일정
              </label>
              <Select
                value={eventId}
                onValueChange={setEventId}
                disabled={rooms.busy}
              >
                <SelectTrigger
                  id="coordination-event"
                  className="w-full"
                  aria-label="조율할 일정"
                >
                  <SelectValue placeholder="일정을 선택해 주세요" />
                </SelectTrigger>
                <SelectContent>
                  {eligible.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.title} ({event.date})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                disabled={!selectedEvent || rooms.busy}
                onClick={() => void create()}
              >
                조율 시작
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              직접 만든 시간 지정 일정에 가족을 함께 넣으면 조율을 시작할 수
              있어요.{" "}
              <Link href="/calendar" className="underline underline-offset-4">
                가족 일정 보기
              </Link>
            </p>
          )}
        </section>
        <section
          className="flex flex-col gap-3"
          aria-labelledby="coordination-list-title"
        >
          <h2 id="coordination-list-title" className="font-semibold">
            참여 중인 조율
          </h2>
          {!rooms.data.length && (
            <p className="text-sm text-muted-foreground">
              아직 함께 조율하는 일정이 없어요.
            </p>
          )}
          {rooms.data.map((item) => (
            <Button
              key={item.id}
              variant={item.id === roomId ? "secondary" : "outline"}
              className="h-auto min-h-11 justify-between gap-3 py-3 text-left whitespace-normal"
              aria-label={`조율 열기: ${item.event.title}`}
              aria-pressed={item.id === roomId}
              disabled={rooms.busy}
              onClick={() => setRoomId(item.id)}
            >
              <span className="min-w-0 break-words">{item.event.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {statusText[item.status]}
              </span>
            </Button>
          ))}
        </section>
        {room && (
          <RoomDetail
            key={`${viewerId}:${room.id}:${room.revision}`}
            room={room}
            viewerId={viewerId}
            names={Object.fromEntries(
              family.members.map((member) => [member.id, member.name])
            )}
            busy={rooms.busy}
            mutate={mutate}
            refresh={refresh}
          />
        )}
      </ResourceState>
    </AppShell>
  )
}

function RoomDetail({
  room,
  viewerId,
  names,
  busy,
  mutate,
  refresh,
}: {
  room: CoordinationRoom
  viewerId: string
  names: Record<string, string>
  busy: boolean
  mutate: (action: string, body: Record<string, unknown>) => Promise<boolean>
  refresh: () => Promise<void>
}) {
  const ownContribution =
    room.contributions.find((item) => item.actorId === viewerId)?.text || ""
  const [contribution, setContribution] = React.useState(ownContribution)
  const [proposal, setProposal] = React.useState<CoordinationProposal>({
    summary: "",
    date: room.event.date,
    startTime: room.event.startTime,
    endTime: room.event.endTime,
  })
  const [preview, setPreview] = React.useState<CoordinationPreview | null>(null)
  const [generating, setGenerating] = React.useState(false)
  const [aiError, setAiError] = React.useState("")
  const [withdrawConfirm, setWithdrawConfirm] = React.useState(false)
  const [validation, setValidation] = React.useState("")
  const errorRef = React.useRef<HTMLParagraphElement>(null)
  const generation = React.useRef(0)
  const active = React.useRef(true)
  React.useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const terminal = ["applied", "declined", "withdrawn"].includes(room.status)
  const [expired, setExpired] = React.useState(
    () => Date.parse(room.expiresAt) <= Date.now()
  )
  React.useEffect(() => {
    const delay = Date.parse(room.expiresAt) - Date.now()
    const timer = setTimeout(() => setExpired(true), Math.max(0, delay))
    return () => clearTimeout(timer)
  }, [room.expiresAt])
  const disabled = busy || generating
  const allAccepted =
    !!room.proposal &&
    room.parties.every((actorId) =>
      room.decisions.some(
        (decision) =>
          decision.actorId === actorId &&
          decision.decision === "accept" &&
          decision.digest === room.proposal?.digest
      )
    )
  function clearPreview() {
    generation.current++
    setPreview(null)
    setAiError("")
  }
  function updateProposal(key: keyof CoordinationProposal, value: string) {
    clearPreview()
    setProposal((current) => ({ ...current, [key]: value }))
    setValidation("")
  }
  async function suggest() {
    const token = ++generation.current
    setGenerating(true)
    setAiError("")
    setPreview(null)
    try {
      const result = await api<CoordinationPreview>(
        `coordinations/${room.id}/suggestions`,
        "POST",
        { expectedRevision: room.revision }
      )
      if (!active.current || token !== generation.current) return
      setPreview(result)
      if (!result.unsupportedReasons.length)
        setProposal({
          summary: result.summary,
          date: result.date,
          startTime: result.startTime,
          endTime: result.endTime,
        })
    } catch (error) {
      if (active.current && token === generation.current)
        setAiError((error as Error).message)
    } finally {
      if (active.current) setGenerating(false)
    }
  }
  async function publish(event: React.FormEvent) {
    event.preventDefault()
    if (disabled) return
    if (proposal.endTime <= proposal.startTime) {
      setValidation("종료 시간은 시작 시간보다 늦게 입력해 주세요.")
      requestAnimationFrame(() => errorRef.current?.focus())
      return
    }
    await mutate("proposals", { proposal })
  }
  return (
    <section
      className="flex flex-col gap-6 border-t border-border pt-6"
      aria-labelledby="coordination-room-title"
    >
      <div className="flex flex-col gap-2">
        <h2 id="coordination-room-title" className="text-xl font-bold">
          {room.event.title}
        </h2>
        <p className="text-sm">
          기존 일정: {room.event.date} {room.event.startTime}–
          {room.event.endTime}
        </p>
        <p role="status" className="text-sm font-medium">
          {statusText[room.status]}
        </p>
        <p className="text-xs text-muted-foreground">
          참여 가족: {room.parties.map((id) => names[id] || "가족").join(", ")}
          <br />
          조율 기한:{" "}
          {new Date(room.expiresAt).toLocaleString("ko-KR", {
            timeZone: "Asia/Seoul",
          })}
        </p>
        {expired && !terminal && (
          <p role="alert">조율 기한이 지났어요. 새 조율을 시작해 주세요.</p>
        )}
        {room.resultEventRevision && (
          <p className="text-sm">
            변경한 일정이 저장됐어요.{" "}
            <Link href="/calendar" className="underline underline-offset-4">
              일정 확인하기
            </Link>
          </p>
        )}
      </div>
      <section
        className="flex flex-col gap-3"
        aria-labelledby="coordination-contributions-title"
      >
        <h3 id="coordination-contributions-title" className="font-semibold">
          공유한 의견
        </h3>
        {room.contributions.length ? (
          room.contributions.map((item) => (
            <Card key={item.actorId} className="gap-2 px-4 py-4">
              <p className="text-sm font-semibold">
                {names[item.actorId] || "가족"}
                {item.actorId === viewerId ? " (나)" : ""}
              </p>
              <p className="text-sm break-words whitespace-pre-wrap">
                {item.text}
              </p>
            </Card>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            공유하기로 확인한 의견만 가족에게 보여요.
          </p>
        )}
        {!terminal && !expired && (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              void mutate("contributions", { text: contribution })
            }}
          >
            <label
              htmlFor="coordination-contribution"
              className="text-sm font-medium"
            >
              가족에게 공유할 의견
            </label>
            <Textarea
              id="coordination-contribution"
              required
              maxLength={500}
              value={contribution}
              disabled={disabled}
              onChange={(event) => {
                clearPreview()
                setContribution(event.target.value)
                setProposal({
                  summary: "",
                  date: room.event.date,
                  startTime: room.event.startTime,
                  endTime: room.event.endTime,
                })
              }}
              aria-describedby="contribution-help"
            />
            <p id="contribution-help" className="text-xs text-muted-foreground">
              이 내용을 참여 가족에게 공유해요. 의견을 바꾸면 기존 제안과 수락은
              초기화돼요.
            </p>
            <Button
              type="submit"
              variant="outline"
              disabled={
                disabled ||
                !contribution.trim() ||
                contribution === ownContribution
              }
            >
              의견 확인하고 공유
            </Button>
          </form>
        )}
      </section>
      {room.proposal && (
        <Card className="gap-4 px-4 py-4">
          <h3 className="font-semibold">
            함께 확인할 제안 {room.proposal.version}
          </h3>
          <p className="break-words whitespace-pre-wrap">
            {room.proposal.summary}
          </p>
          <p className="font-medium">
            {room.proposal.date} {room.proposal.startTime}–
            {room.proposal.endTime}
          </p>
          <p className="text-xs text-muted-foreground">
            일정 제목과 참여자는 유지하고 날짜·시간만 변경해요.
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {room.parties.map((id) => {
              const decision = room.decisions.find(
                (item) =>
                  item.actorId === id && item.digest === room.proposal?.digest
              )
              return (
                <li key={id}>
                  {names[id] || "가족"}
                  {id === viewerId ? " (나)" : ""}:{" "}
                  {decision
                    ? decisionText[decision.decision]
                    : "아직 응답하지 않음"}
                </li>
              )
            })}
          </ul>
          {!terminal && !expired && (
            <>
              <p className="text-sm text-muted-foreground">
                제안을 공유한 사람도 별도로 수락해야 해요. 수정된 제안에는 다시
                수락해 주세요.
              </p>
              <Button
                disabled={disabled}
                onClick={() => void mutate("decisions", { decision: "accept" })}
              >
                이 제안 수락
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  disabled={disabled}
                  onClick={() =>
                    void mutate("decisions", { decision: "defer" })
                  }
                >
                  잠시 보류
                </Button>
                <Button
                  variant="outline"
                  disabled={disabled}
                  onClick={() =>
                    void mutate("decisions", { decision: "decline" })
                  }
                >
                  제안 거절
                </Button>
              </div>
              {room.creatorId === viewerId && (
                <>
                  <Button
                    disabled={
                      disabled || !allAccepted || room.status !== "proposed"
                    }
                    onClick={() => void mutate("apply", {})}
                  >
                    일정에 반영
                  </Button>
                  {!allAccepted && (
                    <p className="text-xs text-muted-foreground">
                      모든 참여 가족이 이 제안을 수락하면 반영할 수 있어요.
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </Card>
      )}
      {!terminal && !expired && (
        <section
          className="flex flex-col gap-4"
          aria-labelledby="coordination-proposal-title"
        >
          <h3 id="coordination-proposal-title" className="font-semibold">
            {room.proposal ? "제안 수정하기" : "변경할 일정 제안하기"}
          </h3>
          <p className="text-sm text-muted-foreground">
            직접 작성하거나 공유한 의견으로 AI 제안을 받아 다듬을 수 있어요.
            공유 전 초안은 새로고침하면 사라져요.
          </p>
          <Button
            variant="outline"
            disabled={
              disabled ||
              !room.contributions.length ||
              contribution !== ownContribution
            }
            onClick={() => void suggest()}
          >
            {generating ? "AI 제안 만드는 중…" : "AI 제안 받기"}
          </Button>
          {!room.contributions.length && (
            <p className="text-xs text-muted-foreground">
              AI 제안을 받으려면 의견을 먼저 공유해 주세요.
            </p>
          )}
          {aiError && (
            <p role="alert" className="text-sm">
              {aiError} 아래에서 직접 작성할 수 있어요.
            </p>
          )}
          {preview &&
            (preview.unsupportedReasons.length ? (
              <div role="alert" className="flex flex-col gap-2 text-sm">
                <p>
                  AI 제안에 추가로 확인할 조건이 있어요. 아래 내용을 확인하고
                  날짜와 시간 변경을 직접 작성해 주세요.
                </p>
                <p className="break-words whitespace-pre-wrap">
                  {preview.summary}
                </p>
                <ul className="list-inside list-disc">
                  {preview.unsupportedReasons.map((reason, index) => (
                    <li key={index}>{reason}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p role="status" className="text-sm">
                AI 초안을 아래에 넣었어요. 내용을 확인하고 필요한 부분을 수정해
                주세요.
              </p>
            ))}
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => void publish(event)}
          >
            <label
              htmlFor="coordination-summary"
              className="text-sm font-medium"
            >
              제안 내용
            </label>
            <Textarea
              id="coordination-summary"
              required
              maxLength={500}
              value={proposal.summary}
              disabled={disabled}
              onChange={(event) =>
                updateProposal("summary", event.target.value)
              }
            />
            <label htmlFor="coordination-date" className="text-sm font-medium">
              변경할 날짜
            </label>
            <Input
              id="coordination-date"
              type="date"
              required
              value={proposal.date}
              disabled={disabled}
              onChange={(event) => updateProposal("date", event.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
                시작 시간
                <Input
                  type="time"
                  required
                  value={proposal.startTime}
                  disabled={disabled}
                  onChange={(event) =>
                    updateProposal("startTime", event.target.value)
                  }
                />
              </label>
              <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
                종료 시간
                <Input
                  type="time"
                  required
                  value={proposal.endTime}
                  disabled={disabled}
                  aria-invalid={!!validation}
                  aria-describedby={
                    validation ? "coordination-validation" : undefined
                  }
                  onChange={(event) =>
                    updateProposal("endTime", event.target.value)
                  }
                />
              </label>
            </div>
            {validation && (
              <p
                id="coordination-validation"
                ref={errorRef}
                tabIndex={-1}
                role="alert"
                className="text-sm"
              >
                {validation}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              공유하면 참여 가족에게 저장된 제안이 보여요. 아직 일정에는
              반영되지 않아요.
            </p>
            <Button
              type="submit"
              disabled={disabled || !proposal.summary.trim()}
            >
              이 제안을 공유
            </Button>
          </form>
        </section>
      )}
      {room.status !== "withdrawn" && (
        <section className="flex flex-col gap-3 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            동의를 철회하면 내 의견을 지우고 이 조율을 마쳐요. 이미 반영된
            일정은 되돌리지 않아요.
          </p>
          {withdrawConfirm ? (
            <>
              <p>이 조율에 대한 내 동의를 철회할까요?</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  disabled={disabled}
                  onClick={() => setWithdrawConfirm(false)}
                >
                  취소
                </Button>
                <Button
                  disabled={disabled}
                  onClick={() => void mutate("withdraw", {})}
                >
                  철회 확인
                </Button>
              </div>
            </>
          ) : (
            <Button
              variant="ghost"
              disabled={disabled}
              onClick={() => setWithdrawConfirm(true)}
            >
              동의 철회
            </Button>
          )}
        </section>
      )}
      <Button
        variant="ghost"
        disabled={disabled}
        onClick={() => void refresh()}
      >
        최신 응답 확인
      </Button>
    </section>
  )
}
