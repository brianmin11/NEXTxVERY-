"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { Heart, MessageCircle, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/woorijip/state-views"
import { HouseholdSetup } from "./account"
import { PageFrame, Panel, memberNames, useFamily } from "./common"
import { NewPrivate, PrivateDetail } from "./private"
import { JointDetail } from "./joint"

type Selection =
  | { kind: "new"; coordinationId?: string; text?: string }
  | { kind: "private" | "joint"; id: string }
  | null
export function RelationshipScreen() {
  return (
    <React.Suspense
      fallback={
        <p role="status" className="p-4">
          내용을 불러오는 중이에요.
        </p>
      }
    >
      <RelationshipContent />
    </React.Suspense>
  )
}
function RelationshipContent() {
  const state = useFamily(),
    view = state.view
  const params = useSearchParams()
  const privateId = params.get("privateId"),
    coordinationId = params.get("coordinationId")
  const [override, setSelection] = React.useState<Selection | undefined>(
    undefined
  )
  const selection: Selection =
    override === undefined
      ? privateId
        ? { kind: "private", id: privateId }
        : coordinationId
          ? { kind: "joint", id: coordinationId }
          : null
      : override
  const entry =
    selection?.kind === "private"
      ? view?.privateEntries.find((e) => e.id === selection.id)
      : undefined
  const coord =
    selection?.kind === "joint"
      ? view?.coordinations.find((c) => c.id === selection.id)
      : undefined
  function choose(next: Selection) {
    setSelection(next)
    const url = new URL(window.location.href)
    url.search = ""
    if (next?.kind === "private") url.searchParams.set("privateId", next.id)
    if (next?.kind === "joint") url.searchParams.set("coordinationId", next.id)
    window.history.replaceState(null, "", url.pathname + url.search)
    window.scrollTo({ top: 0, behavior: "instant" })
  }
  return (
    <PageFrame title="마음 전하기" state={state}>
      {view &&
        (!view.household ? (
          <HouseholdSetup state={state} />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {view.viewer.name}님의 공간 ·{" "}
              {view.modelMode === "test"
                ? "테스트 응답 사용 중"
                : view.modelMode === "unconfigured"
                  ? "AI 연결 준비 중"
                  : "AI로 표현 정리"}
            </p>
            {view.modelMode === "unconfigured" && (
              <p role="status" className="rounded-md bg-secondary p-3 text-sm">
                지금은 AI 정리를 사용할 수 없어요. 개인 입력 저장과 일정 등록은
                할 수 있어요.
              </p>
            )}
            <nav aria-label="마음 전하기 탐색" className="flex flex-wrap gap-2">
              <Button
                variant={selection?.kind === "new" ? "default" : "secondary"}
                disabled={state.busy}
                onClick={() => choose({ kind: "new" })}
              >
                <Plus aria-hidden="true" />새 이야기
              </Button>
              <Button
                variant={selection === null ? "default" : "secondary"}
                disabled={state.busy}
                onClick={() => choose(null)}
              >
                내역 보기
              </Button>
            </nav>
            {selection?.kind === "new" && (
              <NewPrivate
                key={`${selection.coordinationId || "new"}:${selection.text || ""}`}
                state={state}
                coordinationId={selection.coordinationId}
                initialText={selection.text}
                onCreated={(id) => choose({ kind: "private", id })}
              />
            )}
            {entry && (
              <PrivateDetail
                key={entry.id}
                entry={entry}
                view={view}
                state={state}
                onShared={(id) => choose({ kind: "joint", id })}
                onAddDetail={(text) =>
                  choose({
                    kind: "new",
                    text,
                    coordinationId: view.coordinations.some(
                      (c) => c.id === entry.coordinationId
                    )
                      ? entry.coordinationId
                      : undefined,
                  })
                }
                onClose={() => choose(null)}
              />
            )}
            {coord && (
              <JointDetail
                key={coord.id}
                coord={coord}
                view={view}
                state={state}
                onReply={() =>
                  choose({ kind: "new", coordinationId: coord.id })
                }
              />
            )}
            {selection &&
              ((selection.kind === "private" && !entry) ||
                (selection.kind === "joint" && !coord)) && (
                <EmptyState
                  title="내용을 찾을 수 없어요"
                  description="공유가 철회됐거나 접근할 수 없는 내용일 수 있어요."
                  action={
                    <Button onClick={() => choose(null)}>내역 보기</Button>
                  }
                />
              )}
            {!selection && (
              <>
                <Panel
                  title="나만 보는 이야기"
                  description="이 원문과 정리 내용은 다른 가족에게 보이지 않아요."
                >
                  {!view.privateEntries.length ? (
                    <EmptyState
                      icon={Heart}
                      title="아직 쓴 이야기가 없어요"
                      description="마음 정리만 하고 마쳐도 괜찮아요."
                      action={
                        <Button onClick={() => choose({ kind: "new" })}>
                          새 이야기 쓰기
                        </Button>
                      }
                    />
                  ) : (
                    <ul className="divide-y divide-border">
                      {view.privateEntries.map((item) => (
                        <li key={item.id}>
                          <Button
                            className="h-auto min-h-11 w-full justify-start py-3 text-left whitespace-normal"
                            variant="ghost"
                            onClick={() =>
                              choose({ kind: "private", id: item.id })
                            }
                          >
                            <span className="line-clamp-2">{item.text}</span>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
                <Panel
                  title="함께 조율하는 요청"
                  description="나에게 공유된 내용과 내가 승인해 보낸 내용을 모았어요."
                >
                  {!view.coordinations.length ? (
                    <EmptyState
                      icon={MessageCircle}
                      title="아직 공유된 요청이 없어요"
                      description="검토한 문구를 보내면 여기서 함께 확인해요."
                    />
                  ) : (
                    <ul className="divide-y divide-border">
                      {view.coordinations.map((item) => (
                        <li key={item.id}>
                          <Button
                            variant="ghost"
                            className="h-auto min-h-11 w-full flex-col items-start gap-1 py-3 text-left whitespace-normal"
                            onClick={() =>
                              choose({ kind: "joint", id: item.id })
                            }
                          >
                            <span className="font-semibold">
                              {memberNames(item.audience, view)}
                            </span>
                            <span className="line-clamp-2 text-sm text-muted-foreground">
                              {item.agreement?.summary ||
                                item.cards.find((c) => c.state === "active")
                                  ?.exactText ||
                                "공유 내용 확인"}
                            </span>
                            <span className="text-sm">
                              {item.state === "applied"
                                ? "반영 완료"
                                : item.state === "declined"
                                  ? "거절"
                                  : item.state === "deferred"
                                    ? "보류"
                                    : "내용 확인하기"}
                            </span>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              </>
            )}
          </>
        ))}
    </PageFrame>
  )
}
