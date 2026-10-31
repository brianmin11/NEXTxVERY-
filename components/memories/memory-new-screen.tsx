"use client"

import { IS_DEMO } from "@/lib/app-mode"
import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, CircleCheck, ImagePlus, Loader2 } from "lucide-react"

import { useCalendar } from "@/components/calendar/calendar-provider"
import { DemoViewerSwitch } from "@/components/mind/demo-viewer-switch"
import { useReturnFocus } from "@/components/mind/use-return-focus"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { FlowPage } from "@/components/woorijip/flow-page"
import { LeaveDialog } from "@/components/woorijip/leave-dialog"
import { isValidDateKey } from "@/lib/calendar/date"
import { MEMORY_ACCEPT_ATTR, MEMORY_ACCEPT_LABEL, MEMORY_CAPTION_MAX, MEMORY_MAX_LABEL } from "@/lib/memories/config"
import { inspectImageFile, revokeIfBlob } from "@/lib/memories/image"

import { MemoryImage } from "./memory-image"
import { useMemories } from "./memories-provider"

/**
 * 추억 등록(전체 화면). 기기 파일 선택기 → 검사·미리보기 → 날짜·설명 → 명시적 등록.
 * 사진은 File/object URL로만 다루고 서버 전송·영구 저장은 없다.
 */
export function MemoryNewScreen() {
  const router = useRouter()
  const cal = useCalendar()
  const mem = useMemories()
  const { draft, pendingAsset, draftDirty } = mem
  const [picking, setPicking] = React.useState(false)
  const [pickError, setPickError] = React.useState<string | null>(null)
  const [dateTouched, setDateTouched] = React.useState(false)
  const [leaveOpen, setLeaveOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  // 빠르게 다시 고르면 이전 검사 결과가 새 선택을 덮어쓰지 않게 한다.
  const requestRef = React.useRef(0)
  const submittingRef = React.useRef(false)
  const leaveFocus = useReturnFocus()

  React.useEffect(() => {
    if (!draftDirty) return
    const handler = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [draftDirty])

  const dateValid = isValidDateKey(draft.memoryDate)
  const canSubmit = !!pendingAsset && (IS_DEMO || pendingAsset.kind === "remote") && dateValid && !picking && !mem.uploading && draft.step === "compose"
  const done = draft.step === "done"

  async function handleFiles(files: FileList | null) {
    const file = files?.[0]
    // 같은 파일을 다시 고를 수 있도록 입력값은 비운다.
    if (inputRef.current) inputRef.current.value = ""
    if (!file) return
    const id = ++requestRef.current
    setPicking(true)
    setPickError(null)
    const result = await inspectImageFile(file)
    if (id !== requestRef.current) {
      // 더 새 선택이 있다. 이 결과는 버린다.
      if (result.ok) revokeIfBlob(result.objectUrl)
      return
    }
    setPicking(false)
    if (!result.ok) {
      setPickError(result.message)
      return
    }
    const blobAsset = { id: crypto.randomUUID(), kind: "blob" as const, ...result }
    mem.setPendingAsset(blobAsset)
    if (IS_DEMO) return
    // 라이브: 미리보기는 blob으로 먼저 보여 주고, 서버 업로드(형식·용량·실제 내용 검사 후 재인코딩) 결과로 바꾼다.
    const uploadError = await mem.upload(file)
    if (uploadError && id === requestRef.current) setPickError(uploadError)
  }

  async function submit() {
    if (!canSubmit || submittingRef.current || !draft.submitToken) return
    submittingRef.current = true
    const created = await mem.addPost({ memoryDate: draft.memoryDate, caption: draft.caption }, draft.submitToken)
    submittingRef.current = false
    if (!created) setPickError(mem.error ?? "추억을 등록하지 못했어요. 다시 시도해 주세요.")
  }

  function close() {
    if (draftDirty) {
      leaveFocus.capture()
      setLeaveOpen(true)
      return
    }
    // 완료 화면을 떠나면 다음 방문은 새 작성으로 시작한다(등록된 사진은 해제되지 않는다).
    if (done) mem.resetDraft()
    router.push("/memories")
  }

  return (
    <FlowPage
      title={done ? "추억을 남겼어요" : "한 장의 추억 남기기"}
      eyebrow={done ? "완료" : "새 추억"}
      back={close}
      backLabel="작성 닫기"
      action={
        done ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="lg" asChild>
              <Link href="/memories" onClick={() => mem.resetDraft()}>
                목록으로
              </Link>
            </Button>
            <Button size="lg" asChild>
              <Link href={`/memories/${draft.createdPostId}`} onClick={() => mem.resetDraft()}>
                추억 보기
              </Link>
            </Button>
            <Button variant="ghost" className="col-span-2" onClick={() => mem.resetDraft()}>
              새 추억 등록
            </Button>
          </div>
        ) : (
          <>
            <Button size="lg" disabled={!canSubmit} aria-busy={picking} onClick={submit}>
              추억 등록
            </Button>
            {!canSubmit && (
              <p className="text-center text-sm text-muted-foreground">
                {picking ? "사진을 확인하고 있어요." : mem.uploading ? "사진을 올리는 중이에요." : !pendingAsset ? "사진을 고르면 등록할 수 있어요." : "추억 날짜를 골라 주세요."}
              </p>
            )}
          </>
        )
      }
    >
      <DemoViewerSwitch />

      {done ? (
        <div className="flex flex-col items-center gap-3 rounded-xl bg-card px-6 py-10 text-center ring-1 ring-border">
          <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
            <CircleCheck className="size-6" aria-hidden="true" />
          </span>
          <p className="font-semibold">추억을 남겼어요</p>
          <p className="text-sm text-muted-foreground">
            실제 업로드나 가족에게 전송은 하지 않았어요. 이 탭에서만 보이고 새로고침하면 사라져요.
          </p>
        </div>
      ) : (
        <>
          <section aria-labelledby="mem-photo-label" className="flex flex-col gap-2">
            <h2 id="mem-photo-label" className="text-sm font-semibold text-muted-foreground">
              사진 <span className="text-destructive" aria-hidden="true">*</span>
              <span className="sr-only"> (필수)</span>
            </h2>
            <input
              ref={inputRef}
              type="file"
              accept={MEMORY_ACCEPT_ATTR}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => void handleFiles(e.target.files)}
            />
            {pendingAsset ? (
              <div className="flex flex-col gap-2">
                <div className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted ring-1 ring-border">
                  <MemoryImage asset={pendingAsset} alt="선택한 사진 미리보기" fit="contain" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={picking}>
                    사진 교체
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      requestRef.current++
                      setPicking(false)
                      setPickError(null)
                      mem.clearPendingAsset()
                    }}
                  >
                    선택 취소
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-input bg-card px-6 py-8 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
                  <ImagePlus className="size-6" aria-hidden="true" />
                </span>
                <Button onClick={() => inputRef.current?.click()} disabled={picking} aria-describedby="mem-photo-hint">
                  {picking ? (
                    <>
                      <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />
                      사진을 확인하는 중
                    </>
                  ) : (
                    "사진 선택"
                  )}
                </Button>
                <p id="mem-photo-hint" className="text-sm text-muted-foreground">
                  {MEMORY_ACCEPT_LABEL} · {MEMORY_MAX_LABEL} 이하 · 한 장
                </p>
              </div>
            )}
            {picking && pendingAsset && (
              <p role="status" className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
                사진을 확인하는 중
              </p>
            )}
            {pickError && (
              <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {pickError}
              </p>
            )}
          </section>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mem-date" className="text-sm font-semibold text-muted-foreground">
              추억 날짜 <span className="text-destructive" aria-hidden="true">*</span>
              <span className="sr-only"> (필수)</span>
            </Label>
            <Input
              id="mem-date"
              type="date"
              value={draft.memoryDate}
              max={cal.today}
              aria-invalid={dateTouched && !dateValid ? true : undefined}
              aria-describedby={dateTouched && !dateValid ? "mem-date-error" : undefined}
              onBlur={() => setDateTouched(true)}
              onChange={(e) => mem.updateDraft({ memoryDate: e.target.value })}
            />
            {dateTouched && !dateValid && (
              <p id="mem-date-error" role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                날짜를 골라 주세요.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mem-caption" className="text-sm font-semibold text-muted-foreground">
              설명 (선택)
            </Label>
            <Textarea
              id="mem-caption"
              value={draft.caption}
              maxLength={MEMORY_CAPTION_MAX}
              rows={3}
              placeholder="이날의 이야기를 짧게 남겨도 좋아요."
              aria-describedby="mem-caption-count"
              onChange={(e) => mem.updateDraft({ caption: e.target.value })}
            />
            <p id="mem-caption-count" className="self-end text-sm text-muted-foreground tabular-nums">
              {draft.caption.length} / {MEMORY_CAPTION_MAX}
            </p>
          </div>

          <p className="rounded-lg bg-secondary px-4 py-3 text-sm">
            이 데모에서는 현재 브라우저 탭에서만 표시되며, 새로고침하면 사라져요. 실제 업로드·가족 공유는 아직 없어요.
          </p>
        </>
      )}

      <LeaveDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        onCloseAutoFocus={leaveFocus.onCloseAutoFocus}
        onLeave={() => router.push("/memories")}
        onDiscard={() => {
          requestRef.current++
          mem.resetDraft()
          router.push("/memories")
        }}
        description="앱 안에서 다른 화면으로 가면 선택한 사진과 입력은 유지돼요. 새로고침하거나 탭을 닫으면 사라져요(메모리에만 있는 데모예요)."
      />
    </FlowPage>
  )
}
