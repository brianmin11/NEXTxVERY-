"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Coordination, FamilyView } from "@/src/contracts/family"
import { ScheduleFieldsForm } from "./calendar"
import {
  dateRange,
  memberNames,
  Panel,
  selectClass,
  TextArea,
  type FamilyState,
} from "./common"

const fieldLabels: Record<string, string> = { assigneeId: "담당자", start: "시작 시각", end: "종료 시각", deadline: "기한", recurrence: "반복 여부", targetId: "변경할 일정", reminderAt: "알림 시각", reminderRecipients: "알림 받을 사람" };

export function JointDetail({
  coord,
  view,
  state,
  onReply,
}: {
  coord: Coordination
  view: FamilyView
  state: FamilyState
  onReply: () => void
}) {
  const [instruction, setInstruction] = React.useState("")
  const [confirmedFeedback, setConfirmedFeedback] = React.useState(false)
  const [targetId, setTargetId] = React.useState("")
  const [resolveOpen, setResolveOpen] = React.useState(false)
  const target = view.schedules.find((s) => s.id === targetId)
  const plan = coord.plan
  const terminal = coord.state === "declined" || coord.state === "applied"
  const modelReady = view.modelMode !== "unconfigured"
  const [confirmTerms, setConfirmTerms] = React.useState(false)
  async function revise(action: "revise" | "defer" | "decline") {
    const result = await state.run(
      {
        type: "coordination.revise",
        id: coord.id,
        expectedRevision: coord.revision,
        instruction: action === "revise" ? instruction : "",
        action,
      },
      action === "revise"
        ? "수정된 초안을 확인해 주세요. 이전 수락은 이어지지 않아요."
        : action === "defer"
          ? "이번 조율을 보류했어요."
          : "이번 제안을 거절했어요."
    )
    if (result) {
      setInstruction("")
      setConfirmedFeedback(false)
      setResolveOpen(false)
    }
  }
  async function planAction(type: "plan.accept" | "plan.apply") {
    if (!plan) return
    await state.run(
      {
        type,
        id: coord.id,
        expectedRevision: coord.revision,
        planId: plan.id,
        planRevision: plan.revision,
        digest: plan.digest,
      },
      type === "plan.accept"
        ? "이 버전의 실행 내용을 수락했어요."
        : "일정 변경을 저장했어요. 일정 화면에서 확인할 수 있어요."
    )
  }
  return (
    <div
      className="flex flex-col gap-5"
      data-testid={`coordination-${coord.id}`}
    >
      <Panel
        title="함께 나눈 요청"
        description="직접 승인한 문구만으로 조율해요. 서로의 개인 원문은 보이지 않아요."
      >
        <p className="text-sm text-muted-foreground">
          함께하는 사람: {memberNames(coord.audience, view)}
        </p>
        {coord.cards.map((card) => (
          <article key={card.id} className="border-t border-border pt-3">
            <p className="mb-2 font-semibold">
              {memberNames([card.senderId], view)}
            </p>
            {card.state === "active" ? (
              <p className="leading-relaxed whitespace-pre-wrap">
                {card.exactText}
              </p>
            ) : (
              <p className="text-muted-foreground">철회된 문구예요.</p>
            )}
            {card.senderId === view.viewer.id && card.state === "active" && (
              <Button
                className="mt-2"
                variant="ghost"
                disabled={state.busy}
                onClick={() =>
                  void state.run(
                    {
                      type: "share.revoke",
                      id: coord.id,
                      cardId: card.id,
                      expectedRevision: coord.revision,
                    },
                    "공유를 철회했어요. 아직 반영하지 않은 제안은 다시 검토해야 해요."
                  )
                }
              >
                이 문구 공유 철회
              </Button>
            )}
          </article>
        ))}
        {!terminal && (
          <Button variant="secondary" onClick={onReply} disabled={state.busy}>
            내 입장 정리해서 답하기
          </Button>
        )}
        {!terminal && !coord.agreement && (
          <Button
            disabled={
              state.busy ||
              !modelReady ||
              !coord.cards.some((c) => c.state === "active")
            }
            onClick={() =>
              void state.run(
                {
                  type: "coordination.generate",
                  id: coord.id,
                  expectedRevision: coord.revision,
                },
                "공유된 요청으로 쟁점과 합의 초안을 정리했어요."
              )
            }
          >
            함께 조율하기
          </Button>
        )}
        {coord.state === "stale" && (
          <p role="status" className="text-sm text-muted-foreground">
            공유 내용이 바뀌었어요. 최신 요청으로 다시 조율해 주세요.
          </p>
        )}
        {coord.state === "deferred" && (
          <p role="status">
            지금은 보류 중이에요. 준비되면 내용을 수정해 다시 제안할 수 있어요.
          </p>
        )}
        {coord.state === "declined" && (
          <p role="status">이번 제안은 거절됐어요. 일정에 반영되지 않아요.</p>
        )}
      </Panel>
      {coord.analysis && (
        <Panel title="함께 살펴볼 내용">
          {coord.analysis.unrepresentedParticipantIds.length > 0 && (
            <p className="rounded-md bg-secondary p-3">
              {memberNames(coord.analysis.unrepresentedParticipantIds, view)}
              님의 입장은 아직 확인되지 않았어요.
            </p>
          )}
          {(
            [
              ["공통 목표", coord.analysis.commonGoals],
              ["서로 다른 기대", coord.analysis.differingExpectations],
              ["충돌하는 조건", coord.analysis.conflicts],
            ] as const
          ).map(
            ([title, items]) =>
              items.length > 0 && (
                <section key={title} className="space-y-2">
                  <h3 className="font-semibold">{title}</h3>
                  <ul className="list-disc space-y-2 pl-5">
                    {items.map((item, i) => (
                      <li key={i}>{item.text}</li>
                    ))}
                  </ul>
                </section>
              )
          )}
          {coord.analysis.unknowns.length > 0 && (
            <section className="space-y-2">
              <h3 className="font-semibold">아직 확인할 내용</h3>
              <ul className="list-disc space-y-2 pl-5">
                {coord.analysis.unknowns.map((text, i) => (
                  <li key={i}>{text}</li>
                ))}
              </ul>
            </section>
          )}
        </Panel>
      )}
      {coord.agreement && (
        <Panel
          title="합의 초안"
          description={`버전 ${coord.agreement.revision} · 아직 일정에 반영되지 않은 제안이에요.`}
        >
          <p className="leading-relaxed whitespace-pre-wrap">
            {coord.agreement.summary}
          </p>
          {coord.agreement.options.length > 0 && (
            <>
              <h3 className="font-semibold">선택해 볼 수 있는 방법</h3>
              <ul className="list-disc space-y-2 pl-5">
                {coord.agreement.options.map((text, i) => (
                  <li key={i}>{text}</li>
                ))}
              </ul>
              <p className="text-sm text-muted-foreground">
                원하는 방법은 아래 수정 요청에 적어 주세요.
              </p>
            </>
          )}
          {coord.agreement.actions.length > 0 && (
            <>
              <h3 className="font-semibold">제안된 행동</h3>
              <ul className="space-y-3">
                {coord.agreement.actions.map((action, i) => (
                  <li key={i} className="border-l-2 border-border pl-3">
                    <p>{action.description}</p>
                    <Badge variant="outline" className="mt-2">
                      {action.basis === "proposed"
                        ? "직접 확인할 제안"
                        : "공유 내용에 근거"}
                    </Badge>
                    {action.unresolvedFields.length > 0 && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        아직 결정하지 않은 내용:{" "}
                        {action.unresolvedFields.map(field => fieldLabels[field] || field).join(", ")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          {coord.agreement.unknowns.length > 0 && (
            <>
              <h3 className="font-semibold">정해야 하는 내용</h3>
              <ul className="list-disc space-y-2 pl-5">
                {coord.agreement.unknowns.map((text, i) => (
                  <li key={i}>{text}</li>
                ))}
              </ul>
            </>
          )}
          {!terminal && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void revise("revise")
              }}
              className="mt-2 flex flex-col gap-3"
            >
              <label className="space-y-2">
                함께 볼 수정 요청
                <TextArea
                  aria-label="함께 볼 수정 요청"
                  value={instruction}
                  onChange={(e) => {
                    setInstruction(e.target.value)
                    setConfirmedFeedback(false)
                  }}
                  required
                  maxLength={6000}
                  disabled={state.busy}
                />
              </label>
              <p className="text-sm text-muted-foreground">
                이 요청은 함께 조율하는 사람에게 공유돼요. 사적인 이유는 ‘내
                입장 정리해서 답하기’에서 작성해 주세요.
              </p>
              <label className="flex min-h-11 items-start gap-3 py-2">
                <input
                  type="checkbox"
                  checked={confirmedFeedback}
                  onChange={(e) => setConfirmedFeedback(e.target.checked)}
                  className="mt-1 size-5 shrink-0 accent-primary"
                  disabled={state.busy}
                />
                <span>이 수정 요청을 함께 보는 데 동의해요.</span>
              </label>
              <Button
                type="submit"
                disabled={
                  state.busy ||
                  !modelReady ||
                  !instruction.trim() ||
                  !confirmedFeedback
                }
              >
                수정 요청 보내기
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={state.busy}
                  onClick={() => void revise("defer")}
                >
                  보류
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={state.busy}
                  onClick={() => void revise("decline")}
                >
                  거절
                </Button>
              </div>
            </form>
          )}
        </Panel>
      )}
      {coord.agreement?.status === "draft" && !terminal && (
        <Panel
          title="실행할 일정 정하기"
          description="이번에는 기존 일정 한 건을 한 번 변경해요. AI가 제안한 다른 행동·반복·알림은 자동으로 반영하지 않아요."
        >
          <Button
            variant="secondary"
            disabled={state.busy}
            onClick={() => setResolveOpen(!resolveOpen)}
          >
            {resolveOpen
              ? "일정 편집 닫기"
              : plan
                ? "실행 조건 수정하기"
                : "일정 변경 내용 정하기"}
          </Button>
          {resolveOpen && (
            <>
              <label className="space-y-2">
                변경할 일정
                <select
                  aria-label="변경할 일정"
                  className={selectClass}
                  value={targetId}
                  disabled={state.busy}
                  onChange={(e) => {
                    setTargetId(e.target.value)
                    setConfirmTerms(false)
                  }}
                >
                  <option value="">일정을 선택해 주세요</option>
                  {view.schedules
                    .filter((s) =>
                      s.participantIds.every((id) =>
                        coord.audience.includes(id)
                      )
                    )
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                </select>
              </label>
              {!view.schedules.length && (
                <Button asChild variant="secondary">
                  <Link href="/calendar">먼저 일정 등록하기</Link>
                </Button>
              )}
              {target && (
                <>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    현재 일정: {dateRange(target.start, target.end)}
                  </p>
                  <label className="flex min-h-11 items-start gap-3 py-2">
                    <input
                      className="mt-1 size-5 shrink-0 accent-primary"
                      type="checkbox"
                      checked={confirmTerms}
                      onChange={(e) => setConfirmTerms(e.target.checked)}
                      disabled={state.busy}
                    />
                    <span>
                      아래 한 건의 변경만 별도로 확정해요. 다른 제안은 반영하지
                      않아요.
                    </span>
                  </label>
                  <ScheduleFieldsForm
                    key={target.id}
                    initial={target}
                    view={{
                      ...view,
                      members: view.members.filter((m) =>
                        coord.audience.includes(m.id)
                      ),
                    }}
                    busy={state.busy || !confirmTerms}
                    label="실행 내용 검토하기"
                    onSubmit={async (fields) => {
                      const result = await state.run(
                        {
                          type: "plan.resolve",
                          id: coord.id,
                          expectedRevision: coord.revision,
                          targetId: target.id,
                          ...fields,
                        },
                        "실행할 내용을 만들었어요. 당사자 모두가 같은 내용을 수락해야 반영돼요."
                      )
                      if (result) setResolveOpen(false)
                    }}
                  />
                </>
              )}
            </>
          )}
        </Panel>
      )}
      {plan && (
        <Panel
          title="우리집에 반영할 내용"
          description={`실행 계획 버전 ${plan.revision} · 한국 시간(Asia/Seoul)`}
          data-testid={`plan-${plan.id}`}
        >
          <h3 className="font-semibold">{plan.title}</h3>
          {plan.status !== "applied" &&
            view.schedules.find((s) => s.id === plan.targetId) && (
              <p className="text-sm text-muted-foreground">
                변경 전:{" "}
                {dateRange(
                  view.schedules.find((s) => s.id === plan.targetId)!.start,
                  view.schedules.find((s) => s.id === plan.targetId)!.end
                )}
              </p>
            )}
          <p>변경 후: {dateRange(plan.start, plan.end)}</p>
          <p>함께하는 사람: {memberNames(plan.participantIds, view)}</p>
          <p className="text-sm text-muted-foreground">
            한 번만 변경 · 추가 알림 없음
          </p>
          {plan.blockers.length > 0 && (
            <div role="alert">
              <p className="font-semibold">먼저 해결할 내용이 있어요</p>
              <ul className="list-disc pl-5">
                {plan.blockers.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          )}
          <h3 className="font-semibold">이 버전의 수락 상태</h3>
          <ul className="space-y-2">
            {plan.requiredAcceptors.map((id) => (
              <li key={id}>
                {memberNames([id], view)} ·{" "}
                {plan.acceptedBy.includes(id) ? "수락했어요" : "검토 중"}
              </li>
            ))}
          </ul>
          {plan.status === "stale" && (
            <p role="status">
              내용이 바뀌어 이 계획은 더 이상 유효하지 않아요. 실행 조건을 다시
              확인해 주세요.
            </p>
          )}
          {plan.status === "applied" ? (
            <>
              <p role="status" className="rounded-md bg-secondary p-3">
                일정 변경을 저장했어요.
              </p>
              <Button asChild>
                <Link href="/calendar">저장된 일정 보기</Link>
              </Button>
            </>
          ) : (
            !terminal &&
            plan.status !== "stale" && (
              <>
                <Button
                  disabled={
                    state.busy ||
                    plan.blockers.length > 0 ||
                    !plan.requiredAcceptors.includes(view.viewer.id) ||
                    plan.acceptedBy.includes(view.viewer.id)
                  }
                  onClick={() => void planAction("plan.accept")}
                >
                  {plan.acceptedBy.includes(view.viewer.id)
                    ? "이 내용을 수락했어요"
                    : "이 내용 수락"}
                </Button>
                <Button
                  disabled={
                    state.busy ||
                    plan.blockers.length > 0 ||
                    plan.status !== "accepted"
                  }
                  onClick={() => void planAction("plan.apply")}
                >
                  우리집에 반영
                </Button>
                <p className="text-sm text-muted-foreground">
                  전원 수락 후에 반영할 수 있어요. 조건을 바꾸면 모두 다시
                  검토해요.
                </p>
              </>
            )
          )}
        </Panel>
      )}
    </div>
  )
}
