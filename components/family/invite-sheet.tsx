"use client"

import * as React from "react"
import { Copy, Link2, Share2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { PrivacyNote } from "@/components/woorijip/flow-page"
import { inviteLink } from "@/lib/family/invite"

type InviteSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCloseAutoFocus: (event: Event) => void
  familyName: string
  code: string
}

/**
 * 가족 초대 시트(관리자 전용). 데모 코드를 보여 주고 복사·공유만 한다.
 * 실제 코드 발급·만료·사용 횟수는 서버가 정하며, 이 코드는 로그인을 대체하지 않는다.
 */
export function InviteSheet({ open, onOpenChange, onCloseAutoFocus, familyName, code }: InviteSheetProps) {
  const [status, setStatus] = React.useState<string | null>(null)

  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text)
      setStatus(done)
    } catch {
      setStatus("복사할 수 없어요. 코드를 직접 알려 주세요.")
    }
  }

  async function share() {
    const url = inviteLink(code, window.location.origin)
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: `${familyName} 초대`, text: `우리집 '${familyName}'에 참여해요. 초대코드 ${code}`, url })
        setStatus("공유 창을 열었어요.")
        return
      } catch {
        // 사용자가 취소했거나 공유를 지원하지 않는 경우 → 링크 복사로 대체
      }
    }
    await copy(url, "초대 링크를 복사했어요.")
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) setStatus(null)
        onOpenChange(o)
      }}
    >
      <SheetContent side="bottom" onCloseAutoFocus={onCloseAutoFocus}>
        <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" />
        <SheetHeader className="items-center px-5 pt-2 text-center">
          <span className="flex size-19 items-center justify-center rounded-full bg-secondary text-primary">
            <Share2 className="size-7" aria-hidden="true" />
          </span>
          <span className="text-xs font-bold tracking-wide text-primary">가족 초대</span>
          <SheetTitle className="text-2xl font-bold">함께할 가족을 초대해요</SheetTitle>
          <SheetDescription>초대받은 사람도 로그인한 뒤 코드로 참여해요. 코드는 로그인을 대신하지 않아요.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-5">
          <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-input bg-muted px-5 py-4 text-center">
            <span className="text-xs text-muted-foreground">초대코드 · 데모</span>
            <span className="font-display text-3xl font-bold tracking-[0.12em] tabular-nums" aria-label={`초대코드 ${Array.from(code).join(" ")}`}>
              {code}
            </span>
            <span className="text-xs text-muted-foreground">만료·사용 횟수는 서버 연결 후 정해져요</span>
          </div>
          {status && (
            <p role="status" className="rounded-lg bg-secondary px-4 py-2 text-sm">
              {status}
            </p>
          )}
          <Button size="lg" onClick={() => copy(code, "초대코드를 복사했어요.")}>
            <Copy aria-hidden="true" />
            코드 복사
          </Button>
          <Button variant="outline" size="lg" onClick={share}>
            <Link2 aria-hidden="true" />
            초대 링크 공유
          </Button>
          <PrivacyNote>이 데모의 코드는 메모리에만 있어요. 실제 가족이 참여하려면 서버 초대 API가 필요해요.</PrivacyNote>
        </div>
        <SheetFooter className="px-5 pb-5">
          <SheetClose asChild>
            <Button variant="ghost" size="lg">
              닫기
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
