"use client"

import * as React from "react"
import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { FamilyView, PrivateEntry } from "@/src/contracts/family"
import { Members, Panel, TextArea, type FamilyState } from "./common"

const routes = [
  { value: "reflect", title: "내 마음 정리만 하기" },
  { value: "share", title: "전달할 문구 만들기" },
  { value: "coordinate", title: "생활 일정·역할 조율하기" },
] as const
export function NewPrivate({
  state,
  coordinationId,
  initialText = "",
  onCreated,
}: {
  state: FamilyState
  coordinationId?: string
  initialText?: string
  onCreated: (id: string) => void
}) {
  const [text, setText] = React.useState(initialText),
    [route, setRoute] = React.useState<PrivateEntry["route"]>(
      coordinationId ? "coordinate" : "reflect"
    )
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const result = await state.run(
      {
        type: "private.create",
        text,
        route,
        ...(coordinationId ? { coordinationId } : {}),
      },
      "나만 보는 공간에 저장했어요. 아직 가족에게 전달되지 않았어요."
    )
    if (result?.createdId) onCreated(result.createdId)
  }
  return (
    <Panel
      title={coordinationId ? "내 입장 정리" : "내 이야기"}
      description="원문은 나만 볼 수 있어요. 전달할 내용은 다음 단계에서 직접 확인해요."
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <fieldset disabled={state.busy} className="space-y-1">
          <legend className="mb-2 font-medium">어떤 도움이 필요한가요?</legend>
          {routes.map((r) => (
            <label
              key={r.value}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-muted"
            >
              <input
                type="radio"
                name="route"
                value={r.value}
                checked={route === r.value}
                onChange={() => setRoute(r.value)}
                className="size-5 accent-primary"
              />
              <span>{r.title}</span>
            </label>
          ))}
        </fieldset>
        <label className="space-y-2">
          내 이야기
          <TextArea
            aria-label="내 이야기"
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
            maxLength={6000}
            disabled={state.busy}
          />
        </label>
        <p className="text-sm text-muted-foreground">
          이 내용은 개인 이력에 저장돼요. 이번 연결에서는 과거 대화를 AI
          기억으로 자동 사용하지 않아요.
        </p>
        <Button type="submit" disabled={state.busy || !text.trim()}>
          개인 공간에 저장
        </Button>
      </form>
    </Panel>
  )
}
export function PrivateDetail({
  entry,
  view,
  state,
  onShared,
  onAddDetail,
  onClose,
}: {
  entry: PrivateEntry
  view: FamilyView
  state: FamilyState
  onShared: (id: string) => void
  onAddDetail: (text: string) => void
  onClose: () => void
}) {
  const ownCoord = view.coordinations.find((c) => c.id === entry.coordinationId)
  const recipientMembers = view.members.filter(
    (m) =>
      m.id !== view.viewer.id && (!ownCoord || ownCoord.audience.includes(m.id))
  )
  const [recipients, setRecipients] = React.useState(
    entry.shareDraft?.recipients || []
  )
  const [constraintsOnly, setConstraintsOnly] = React.useState(false)
  const [exactText, setExactText] = React.useState(
    entry.shareDraft?.exactText || ""
  )
  const [approved, setApproved] = React.useState(false)
  const modelReady = view.modelMode !== "unconfigured"
  const privateSupport = entry.personal?.disposition === "private_support"
  const canShare = entry.route !== "reflect" && !privateSupport
  async function draft() {
    const result = await state.run(
      {
        type: "private.share",
        id: entry.id,
        expectedRevision: entry.revision,
        recipients,
        constraintsOnly,
      },
      "공유 초안을 만들었어요. 문구를 확인한 뒤 보내 주세요."
    )
    if (result) {
      const next = result.view.privateEntries.find((e) => e.id === entry.id)
      setExactText(next?.shareDraft?.exactText || "")
      setApproved(false)
    }
  }
  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const result = await state.run(
      {
        type: "share.approve",
        id: entry.id,
        expectedRevision: entry.revision,
        exactText,
        recipients,
      },
      "확인한 문구를 선택한 가족에게 전달했어요."
    )
    if (result) onShared(result.createdId || entry.coordinationId)
  }
  return (
    <div
      className="flex flex-col gap-5"
      data-testid={`private-entry-${entry.id}`}
    >
      <Panel title="나만 보는 원문">
        <Badge variant="secondary" className="self-start">
          <Lock className="mr-1 size-3.5" aria-hidden="true" />
          비공개
        </Badge>
        <p className="leading-relaxed whitespace-pre-wrap">{entry.text}</p>
        <p className="text-sm text-muted-foreground">
          선택한 도움: {routes.find((r) => r.value === entry.route)?.title}
        </p>
        <Button
          disabled={state.busy || !modelReady}
          onClick={() =>
            void state.run(
              {
                type: "private.analyze",
                id: entry.id,
                expectedRevision: entry.revision,
              },
              "내 표현을 정리했어요."
            )
          }
        >
          내 표현 정리하기
        </Button>
      </Panel>
      {entry.personal && (
        <Panel title="내 표현 정리">
          <p className="leading-relaxed whitespace-pre-wrap">
            {entry.personal.response}
          </p>
          {entry.personal.claims.length > 0 && (
            <ul className="space-y-3">
              {entry.personal.claims.map((claim, i) => (
                <li key={i} className="border-l-2 border-border pl-3">
                  <p>{claim.statement}</p>
                  <details className="mt-1 text-sm text-muted-foreground">
                    <summary className="min-h-11 cursor-pointer py-3 focus-visible:outline-2 focus-visible:outline-ring">
                      내가 쓴 근거 보기
                    </summary>
                    {claim.evidence.map((e, j) => (
                      <blockquote
                        key={j}
                        className="border-l border-border pl-2 whitespace-pre-wrap"
                      >
                        {e.quote}
                      </blockquote>
                    ))}
                  </details>
                </li>
              ))}
            </ul>
          )}
          {entry.personal.unknowns.length > 0 && (
            <>
              <h3 className="font-semibold">아직 확인하지 않은 내용</h3>
              <ul className="list-disc space-y-1 pl-5">
                {entry.personal.unknowns.map((u, i) => (
                  <li key={i}>{u}</li>
                ))}
              </ul>
            </>
          )}
          {entry.personal.questions.length > 0 && (
            <>
              <h3 className="font-semibold">더 알려주고 싶은 내용이 있나요?</h3>
              <ul className="list-disc space-y-2 pl-5">
                {entry.personal.questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
              <Button
                variant="secondary"
                disabled={state.busy}
                onClick={() => onAddDetail(entry.text)}
              >
                추가 설명을 넣어 새로 정리
              </Button>
            </>
          )}
          {privateSupport && (
            <p className="rounded-md bg-secondary p-3 text-sm">
              이 이야기는 개인 공간에서 이어가요. 공동 조율로 전달하지 않아요.
            </p>
          )}
          <Button variant="secondary" disabled={state.busy} onClick={onClose}>
            여기서 마치기
          </Button>
        </Panel>
      )}
      {canShare && (
        <Panel
          title="전달할 문구 준비"
          description="내 사적인 이유를 빼고 필요한 조건만 전달할 수도 있어요."
        >
          <Members
            members={recipientMembers}
            selected={recipients}
            onChange={(ids) => {
              setRecipients(ids)
              setApproved(false)
            }}
            disabled={state.busy}
            legend="받는 사람"
          />
          {!recipientMembers.length && (
            <p className="text-sm text-muted-foreground">
              가족이 참여하면 문구를 전달할 수 있어요. 더보기에서 초대 코드를
              확인해 주세요.
            </p>
          )}
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={constraintsOnly}
              onChange={(e) => setConstraintsOnly(e.target.checked)}
              disabled={state.busy}
              className="size-5 accent-primary"
            />
            이유는 빼고 필요한 조건만 전달
          </label>
          <Button
            variant="secondary"
            disabled={state.busy || !recipients.length || !modelReady}
            onClick={() => void draft()}
          >
            공유 문구 만들기
          </Button>
        </Panel>
      )}
      {canShare && entry.shareDraft && (
        <Panel
          title="공유 문구 확인"
          description="아래 문장만 선택한 사람에게 보여요. 원문은 함께 보내지 않아요."
        >
          <form onSubmit={send} className="flex flex-col gap-4">
            <label className="space-y-2">
              전달할 문장
              <TextArea
                aria-label="전달할 문장"
                value={exactText}
                onChange={(e) => {
                  setExactText(e.target.value)
                  setApproved(false)
                }}
                required
                maxLength={6000}
                disabled={state.busy}
              />
            </label>
            {entry.shareDraft.reviewItems.length > 0 && (
              <>
                <h3 className="font-semibold">보내기 전에 확인해 주세요</h3>
                <ul className="list-disc space-y-2 pl-5">
                  {entry.shareDraft.reviewItems.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </>
            )}
            <p className="text-sm text-muted-foreground">
              받는 사람:{" "}
              {recipientMembers
                .filter((m) => recipients.includes(m.id))
                .map((m) => m.name)
                .join(", ") || "선택해 주세요"}
            </p>
            <label className="flex min-h-11 items-start gap-3 py-2">
              <input
                type="checkbox"
                checked={approved}
                onChange={(e) => setApproved(e.target.checked)}
                disabled={state.busy}
                className="mt-1 size-5 shrink-0 accent-primary"
              />
              <span>전달할 문구와 받는 사람을 확인했어요.</span>
            </label>
            <Button
              type="submit"
              disabled={
                state.busy ||
                !approved ||
                !recipients.length ||
                !exactText.trim()
              }
            >
              이 문구 보내기
            </Button>
          </form>
        </Panel>
      )}
      {entry.route === "reflect" && !entry.personal && (
        <Button variant="secondary" onClick={onClose}>
          마음 정리만 하고 마치기
        </Button>
      )}
    </div>
  )
}
