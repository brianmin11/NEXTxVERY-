"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type LeaveDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCloseAutoFocus: (event: Event) => void
  /** 내용을 두고 나가기 */
  onLeave: () => void
  /** 내용을 지우고 나가기 */
  onDiscard: () => void
  description?: string
}

/** 작성 화면(마음 전하기·추억 등록)에서 같은 유실 확인 흐름을 쓴다. */
export function LeaveDialog({
  open,
  onOpenChange,
  onCloseAutoFocus,
  onLeave,
  onDiscard,
  description = "앱 안에서 다른 화면으로 가면 내용은 유지돼요. 새로고침하거나 탭을 닫으면 사라져요(메모리에만 있는 데모예요).",
}: LeaveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>작성 중인 내용이 있어요</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={() => onOpenChange(false)}>계속 작성</Button>
          <Button variant="outline" onClick={onLeave}>
            내용 두고 나가기
          </Button>
          <Button variant="destructive" onClick={onDiscard}>
            내용 지우고 나가기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
