"use client"
import * as React from "react"
import type {
  MindDraft,
  MindMessage,
  MindResponse,
  MindStep,
} from "@/lib/mind/types"
import { useDemoViewer } from "./session"
import { useResource, ResourceState, api } from "./client"
export type MindAction =
  | {
      type: "draft/update"
      patch: Partial<Omit<MindDraft, "step" | "confirmToken" | "sentMessageId">>
    }
  | { type: "draft/step"; step: MindStep; confirmToken?: string }
  | { type: "draft/reset" }
  | { type: "message/send"; message: MindMessage; confirmToken: string }
  | { type: "message/read"; id: string }
  | { type: "message/respond"; id: string; response: MindResponse }
const empty = (): MindDraft => ({
  recipientId: null,
  rawText: "",
  outgoingText: "",
  step: "compose",
  confirmToken: null,
  sentMessageId: null,
})
function useValue() {
  const viewer = useDemoViewer(),
    r = useResource<MindMessage[]>("mind/messages", [])
  const [draft, setDraft] = React.useState(empty),
    version = React.useRef(0),
    [suggesting, setSuggesting] = React.useState(false),
    [suggestionError, setSuggestionError] = React.useState("")
  async function dispatch(a: MindAction): Promise<boolean> {
    switch (a.type) {
      case "draft/reset":
        version.current++
        setDraft(empty())
        return true
      case "draft/update": {
        const changed =
          ("rawText" in a.patch && a.patch.rawText !== draft.rawText) ||
          ("recipientId" in a.patch &&
            a.patch.recipientId !== draft.recipientId)
        if (changed || "outgoingText" in a.patch) version.current++
        setDraft((d) => ({
          ...d,
          ...a.patch,
          ...(changed ? { outgoingText: "", confirmToken: null } : {}),
        }))
        return true
      }
      case "draft/step":
        setDraft((d) => ({
          ...d,
          step: a.step,
          confirmToken: a.confirmToken ?? d.confirmToken,
        }))
        return true
      case "message/send": {
        const m = await r.mutate<MindMessage>(
          "mind/messages",
          "POST",
          { text: a.message.text, recipientMemberId: a.message.toId },
          a.confirmToken
        )
        if (m) {
          setDraft((d) => ({
            ...d,
            rawText: "",
            outgoingText: "",
            step: "sent",
            sentMessageId: m.id,
          }))
          return true
        }
        return false
      }
      case "message/read":
        return !!(await r.mutate("mind/messages/" + a.id + "/read", "PUT", {}))
      case "message/respond":
        return !!(await r.mutate("mind/messages/" + a.id + "/response", "PUT", {
          response: a.response,
          expectedRevision: r.data.find((m) => m.id === a.id)?.revision,
        }))
    }
  }
  async function suggest() {
    if (suggesting || !draft.recipientId) return
    const current = version.current
    setSuggesting(true)
    setSuggestionError("")
    try {
      const result = await api<{ text: string; clientDraftVersion: number }>(
        "mind/suggestions",
        "POST",
        {
          rawText: draft.rawText,
          recipientMemberId: draft.recipientId,
          clientDraftVersion: current,
        }
      )
      if (version.current === current)
        setDraft((d) => ({ ...d, outgoingText: result.text }))
    } catch (e) {
      setSuggestionError((e as Error).message)
    } finally {
      setSuggesting(false)
    }
  }
  return {
    ...r,
    ...viewer,
    messages: r.data,
    draft,
    draftDirty:
      draft.step !== "sent" && !!(draft.rawText || draft.outgoingText),
    dispatch,
    suggest,
    suggesting,
    suggestionError,
  }
}
const Context = React.createContext<ReturnType<typeof useValue> | null>(null)
export function MindProvider({ children }: { children: React.ReactNode }) {
  const v = useValue()
  return (
    <Context.Provider value={v}>
      <ResourceState {...v} retry={v.refresh}>
        {children}
      </ResourceState>
    </Context.Provider>
  )
}
export function useMind() {
  const v = React.useContext(Context)
  if (!v) throw new Error("MindProvider 필요")
  return v
}
