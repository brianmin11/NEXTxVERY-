"use client"

import * as React from "react"
import { Check, FlaskConical } from "lucide-react"

import { useChores } from "@/components/chores/chores-provider"
import { useFamily } from "@/components/family/family-provider"
import { FamilyAvatar } from "@/components/home/family-avatar"
import { useMemories } from "@/components/memories/memories-provider"
import { useMind } from "@/components/mind/mind-provider"
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
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { memberRoleLabel } from "@/lib/family/types"
import { cn } from "@/lib/utils"

/**
 * 데모 컨트롤: 현재 인물을 바꿔 양쪽 화면을 확인한다. 사용자용 기능이 아니고 로그인·인증·권한 검증이 아니다.
 * 한 줄 바(현재 인물·권한)와 시트(구성원 목록)로 두어 화면 본문을 가리지 않는다.
 * 작성 중 초안이 있으면 바꾸기 전에 묻고, 바꾸면 그 초안은 보이지 않는다.
 */
export function DemoViewerSwitch({ className }: { className?: string }) {
  const { family, viewer, viewerId, setViewerId } = useFamily()
  const { draftDirty: mindDirty } = useMind()
  const memories = useMemories()
  const chores = useChores()
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState<string | null>(null)
  const sheetFocus = useReturnFocus()
  const dialogFocus = useReturnFocus()
  const dirty = mindDirty || memories.draftDirty || chores.draftDirty

  function request(id: string) {
    if (id === viewerId) {
      setOpen(false)
      return
    }
    if (dirty) {
      dialogFocus.capture()
      setPending(id)
    } else {
      setViewerId(id)
      setOpen(false)
    }
  }

  function confirmSwitch() {
    if (!pending) return
    // 추억 초안의 임시 사진은 object URL까지 해제한다(마음 초안은 작성자에게만 보이므로 그대로 둔다).
    if (memories.draftDirty) memories.resetDraft()
    if (chores.draftDirty) chores.resetDraft()
    setViewerId(pending)
    setPending(null)
    setOpen(false)
  }

  return (
    <div className={cn("flex min-h-10 items-center justify-between gap-2 rounded-lg bg-muted px-3 py-1 text-xs", className)}>
      <p className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
        <FlaskConical className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">
          데모 인물 <span className="font-semibold text-foreground">{viewer.name}</span> · {memberRoleLabel(family, viewer)}
        </span>
      </p>
      <Button
        variant="ghost"
        className="h-11 shrink-0 px-2 text-xs"
        onClick={(e) => {
          sheetFocus.capture(e.currentTarget)
          setOpen(true)
        }}
      >
        인물 전환
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" onCloseAutoFocus={sheetFocus.onCloseAutoFocus}>
          <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" />
          <SheetHeader className="px-5 pt-2">
            <SheetTitle className="pr-10 text-xl font-bold">데모 인물 전환</SheetTitle>
            <SheetDescription>화면 확인용이에요. 로그인이나 실제 계정 전환이 아니에요.</SheetDescription>
          </SheetHeader>
          <ul role="radiogroup" aria-label="데모 인물" className="flex flex-col divide-y divide-border px-5">
            {family.members.map((m) => {
              const selected = m.id === viewerId
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => request(m.id)}
                    className="flex min-h-15 w-full items-center gap-3 rounded-md px-1 text-left outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset active:bg-muted"
                  >
                    <FamilyAvatar member={m} size={40} decorative />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-semibold">{m.name}</span>
                      <span className="text-sm text-muted-foreground">{memberRoleLabel(family, m)}</span>
                    </span>
                    {selected && <Check className="size-5 text-primary" aria-hidden="true" />}
                  </button>
                </li>
              )
            })}
          </ul>
          <SheetFooter className="px-5 pb-5">
            <SheetClose asChild>
              <Button variant="outline" size="lg">
                닫기
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent onCloseAutoFocus={dialogFocus.onCloseAutoFocus}>
          <DialogHeader>
            <DialogTitle>작성 중인 내용이 지워져요</DialogTitle>
            <DialogDescription>
              데모 인물을 바꾸면 지금 쓰던 내용(마음 원문·전달 문장, 고른 사진·설명)은 사라져요. 다른 인물의 화면에 남지 않게
              하기 위해서예요.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              계속 작성
            </Button>
            <Button variant="destructive" onClick={confirmSwitch}>
              지우고 전환
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
