"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { DemoViewerSwitch } from "@/components/demo/demo-viewer-switch"
import { useFamily } from "@/components/family/family-provider"
import { useReturnFocus } from "@/components/mind/use-return-focus"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FlowPage } from "@/components/woorijip/flow-page"
import { validateMemberName } from "@/lib/family/validate"

import { CharacterForm, type CharacterDraft } from "./character-form"

/**
 * 내 캐릭터 편집(전체 화면). 초안 미리보기 → 저장 → 반영. 취소하면 원래 캐릭터가 그대로다.
 * 본인 캐릭터만 바꿀 수 있고(provider도 같은 권한 함수로 확인), 다른 구성원은 건드리지 않는다.
 */
export function CharacterEditorScreen({ returnTo = "/more" }: { returnTo?: string }) {
  const router = useRouter()
  const { viewer, updateMyProfile } = useFamily()
  const [draft, setDraft] = React.useState<CharacterDraft>({ name: viewer.name, avatar: viewer.avatar })
  const [nameError, setNameError] = React.useState<string | null>(null)
  const [leaveOpen, setLeaveOpen] = React.useState(false)
  const [notice, setNotice] = React.useState<string | null>(null)
  const leaveFocus = useReturnFocus()
  // 데모 인물을 바꾸면 그 인물의 캐릭터로 새로 시작한다.
  const [draftOwner, setDraftOwner] = React.useState(viewer.id)
  if (draftOwner !== viewer.id) {
    setDraftOwner(viewer.id)
    setDraft({ name: viewer.name, avatar: viewer.avatar })
    setNameError(null)
  }

  const dirty =
    draft.name !== viewer.name ||
    draft.avatar.skin !== viewer.avatar.skin ||
    draft.avatar.hair !== viewer.avatar.hair ||
    draft.avatar.outfit !== viewer.avatar.outfit ||
    draft.avatar.accessory !== viewer.avatar.accessory

  React.useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [dirty])

  function save() {
    const error = validateMemberName(draft.name)
    setNameError(error)
    if (error) {
      document.getElementById("character-name")?.focus()
      return
    }
    const ok = updateMyProfile({ name: draft.name.trim(), avatar: draft.avatar })
    if (!ok) {
      setNotice("저장하지 못했어요. 본인 캐릭터만 바꿀 수 있어요.")
      return
    }
    router.push(returnTo)
  }

  function cancel() {
    if (dirty) {
      leaveFocus.capture()
      setLeaveOpen(true)
    } else router.push(returnTo)
  }

  return (
    <FlowPage
      title="내 캐릭터"
      eyebrow="나"
      back={cancel}
      backLabel="편집 취소"
      action={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="lg" onClick={cancel}>
            취소 · 기존 설정 유지
          </Button>
          <Button size="lg" onClick={save} disabled={!dirty}>
            변경 저장
          </Button>
        </div>
      }
    >
      <DemoViewerSwitch />
      <p className="text-sm text-muted-foreground">선택은 미리보기에만 반영되고, 저장하기 전까지 기존 캐릭터는 유지돼요.</p>
      {notice && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {notice}
        </p>
      )}
      <CharacterForm
        draft={draft}
        nameError={nameError}
        onChange={(patch) => {
          if ("name" in patch && patch.name !== undefined) setNameError(null)
          setDraft((d) => ({ ...d, ...patch, avatar: { ...d.avatar, ...(patch.avatar ?? {}) } }))
        }}
      />

      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent onCloseAutoFocus={leaveFocus.onCloseAutoFocus}>
          <DialogHeader>
            <DialogTitle>변경 내용을 버릴까요?</DialogTitle>
            <DialogDescription>저장하지 않은 선택은 사라지고 원래 캐릭터는 그대로 유지돼요.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveOpen(false)}>
              계속 고르기
            </Button>
            <Button variant="destructive" onClick={() => router.push(returnTo)}>
              버리고 나가기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FlowPage>
  )
}
