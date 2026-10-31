"use client"

import * as React from "react"

import { useDemoViewer } from "@/components/demo/demo-viewer-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { useMind } from "./mind-provider"
import { useReturnFocus } from "./use-return-focus"

/**
 * 양쪽 화면을 확인하기 위한 데모 인물 전환. 로그인·인증·권한 검증이 아니다.
 * 모든 데모 기능이 같은 인물을 읽는다. 마음 전하기 초안이 있으면 바꾸기 전에 묻고, 바꾸면 그 초안은 보이지 않는다.
 */
export function DemoViewerSwitch() {
  const { family, viewerId, setViewerId } = useDemoViewer()
  const { draftDirty } = useMind()
  const [pending, setPending] = React.useState<string | null>(null)
  const returnFocus = useReturnFocus()

  function request(id: string) {
    if (id === viewerId) return
    if (draftDirty) {
      returnFocus.capture()
      setPending(id)
    } else setViewerId(id)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-muted-foreground">데모 인물 전환 · 로그인이 아니에요</p>
      <Tabs value={viewerId} onValueChange={request}>
        <TabsList aria-label="데모 인물" className="w-full">
          {family.members.map((m) => (
            <TabsTrigger key={m.id} value={m.id} className="flex-1">
              {m.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent onCloseAutoFocus={returnFocus.onCloseAutoFocus}>
          <DialogHeader>
            <DialogTitle>작성 중인 내용이 지워져요</DialogTitle>
            <DialogDescription>
              데모 인물을 바꾸면 지금 쓰던 원문과 전달 문장은 사라져요. 다른 인물의 화면에 남지 않게 하기 위해서예요.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              계속 작성
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pending) setViewerId(pending)
                setPending(null)
              }}
            >
              지우고 전환
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
