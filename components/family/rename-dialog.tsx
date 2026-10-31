"use client"

import * as React from "react"
import { AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FAMILY_NAME_MAX_LENGTH } from "@/lib/family/config"
import { validateFamilyName } from "@/lib/family/validate"

type RenameDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCloseAutoFocus: (event: Event) => void
  current: string
  /** 검증을 통과한 이름으로 호출. false를 돌려주면 권한·서버 오류로 표시한다. */
  onSave: (name: string) => Promise<boolean>
  lastError?: string | null
}

/** 가족 이름 변경(관리자 전용). 짧은 입력이라 대화상자로 둔다. */
export function RenameFamilyDialog({ open, onOpenChange, onCloseAutoFocus, current, onSave, lastError }: RenameDialogProps) {
  const [name, setName] = React.useState(current)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [base, setBase] = React.useState(current)
  if (base !== current) {
    setBase(current)
    setName(current)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    const err = validateFamilyName(name)
    if (err) {
      setError(err)
      return
    }
    setBusy(true)
    const ok = await onSave(name.trim())
    setBusy(false)
    if (!ok) {
      setError(lastError ?? "가족 관리자만 이름을 바꿀 수 있어요.")
      return
    }
    setError(null)
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setName(current)
          setError(null)
        }
        onOpenChange(o)
      }}
    >
      <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>가족 이름 바꾸기</DialogTitle>
            <DialogDescription>가족 구성원 모두에게 같은 이름으로 보여요.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="family-name" className="text-sm font-semibold text-muted-foreground">
              가족 이름
            </Label>
            <Input
              id="family-name"
              value={name}
              maxLength={FAMILY_NAME_MAX_LENGTH}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "family-name-error family-name-hint" : "family-name-hint"}
              onChange={(e) => {
                setName(e.target.value)
                setError(null)
              }}
            />
            <div className="flex items-start justify-between gap-3">
              {error ? (
                <p id="family-name-error" role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
                  <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                  {error}
                </p>
              ) : (
                <span />
              )}
              <p id="family-name-hint" className="shrink-0 text-sm text-muted-foreground tabular-nums">
                {Array.from(name).length} / {FAMILY_NAME_MAX_LENGTH}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit" disabled={name.trim() === current || busy} aria-busy={busy}>
              {busy ? "저장하는 중" : "저장"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
