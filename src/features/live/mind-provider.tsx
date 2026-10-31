"use client"

import * as React from "react"

import { useFamily } from "@/components/family/family-context"
import { emptyMindDraft, MindContext, type MindContextValue, type SuggestionPhase } from "@/components/mind/mind-context"
import type { MindDraft, MindMessage } from "@/lib/mind/types"

import { api, ApiError, ResourceState, useResource } from "./client"

/**
 * 라이브 마음 provider: `GET/POST /api/v2/mind/messages`, `PUT …/:id/read`, `PUT …/:id/response`, `POST /api/v2/mind/suggestions`.
 * 원문(rawText)과 제안 초안은 브라우저 메모리에만 있고 서버는 제안 요청을 처리할 때만 원문을 받아 보관하지 않는다.
 * 원문·수신자가 바뀌면 `version`이 올라가 늦게 도착한 제안은 버린다. 전송은 확인 단계의 confirmToken으로 1회만 보낸다.
 */
export function LiveMindProvider({ children }: { children: React.ReactNode }) {
  const { family, viewer, viewerId } = useFamily()
  const r = useResource<MindMessage[]>("mind/messages", [])
  const [draft, setDraft] = React.useState<MindDraft>(emptyMindDraft)
  const version = React.useRef(0)
  const [phase, setPhase] = React.useState<SuggestionPhase>("idle")
  const [label, setLabel] = React.useState<string | null>(null)
  const [suggestionError, setSuggestionError] = React.useState<string | null>(null)
  const messages = r.data

  const value: MindContextValue = {
    family,
    viewer,
    viewerId,
    messages,
    draft,
    draftDirty: draft.step !== "sent" && (draft.rawText.trim() !== "" || draft.outgoingText.trim() !== ""),
    dispatch: async (a) => {
      switch (a.type) {
        case "draft/reset":
          version.current++
          setPhase("idle")
          setLabel(null)
          setSuggestionError(null)
          setDraft(emptyMindDraft())
          return true
        case "draft/update": {
          const changed =
            ("rawText" in a.patch && a.patch.rawText !== draft.rawText) ||
            ("recipientId" in a.patch && a.patch.recipientId !== draft.recipientId)
          if (changed) {
            version.current++
            if (phase === "success") {
              setPhase("idle")
              setLabel(null)
            }
          }
          setDraft((d) => (d.step === "sent" ? d : { ...d, ...a.patch, ...(changed ? { confirmToken: null } : {}) }))
          return true
        }
        case "draft/step":
          setDraft((d) => ({ ...d, step: a.step, confirmToken: a.confirmToken ?? d.confirmToken }))
          return true
        case "message/send": {
          if (draft.sentMessageId || draft.confirmToken !== a.confirmToken) return false
          const m = await r.mutate<MindMessage>("mind/messages", "POST", { text: a.message.text, recipientMemberId: a.message.toId }, a.confirmToken)
          if (!m) return false
          // 전송된 뒤 원문·초안은 브라우저에서도 지운다.
          setDraft((d) => ({ ...d, rawText: "", outgoingText: "", step: "sent", sentMessageId: m.id }))
          return true
        }
        case "message/read": {
          const m = messages.find((x) => x.id === a.id)
          if (!m || m.toId !== viewerId || m.status !== "sent") return false
          return !!(await r.mutate(`mind/messages/${a.id}/read`, "PUT", {}))
        }
        case "message/respond":
          return !!(await r.mutate(`mind/messages/${a.id}/response`, "PUT", {
            response: a.response.kind === "reply" ? { kind: "reply", text: a.response.text } : { kind: a.response.kind },
            expectedRevision: messages.find((m) => m.id === a.id)?.revision,
          }))
      }
    },
    canSuggest: true,
    suggest: async () => {
      if (phase === "loading" || !draft.recipientId || draft.rawText.trim() === "") return
      const current = version.current
      setPhase("loading")
      setSuggestionError(null)
      try {
        const result = await api<{ mode: "suggested"; text: string; label: string; clientDraftVersion: number }>("mind/suggestions", "POST", {
          rawText: draft.rawText,
          recipientMemberId: draft.recipientId,
          clientDraftVersion: current,
        })
        // 요청 중 원문·수신자가 바뀌었으면 결과를 버린다.
        if (version.current !== current) return
        setDraft((d) => ({ ...d, outgoingText: result.text }))
        setLabel(result.label)
        setPhase("success")
      } catch (e) {
        if (version.current !== current) return
        setSuggestionError(e instanceof ApiError ? e.message : "AI 제안을 받지 못했어요. 직접 쓰거나 잠시 후 다시 시도해 주세요.")
        setPhase("error")
      }
    },
    suggestion: { phase, label, error: suggestionError },
    loading: r.loading,
    error: r.error || null,
    refresh: r.refresh,
  }
  return (
    <MindContext.Provider value={value}>
      <ResourceState loading={r.loading} error={r.error} busy={r.busy} retry={r.refresh}>
        {children}
      </ResourceState>
    </MindContext.Provider>
  )
}
