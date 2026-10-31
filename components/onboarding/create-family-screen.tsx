"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, ShieldCheck } from "lucide-react"

import { CharacterForm, type CharacterDraft } from "@/components/character/character-form"
import { useFamily } from "@/components/family/family-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FlowHeading, FlowLead, FlowPage, PrivacyNote, StepLabel } from "@/components/woorijip/flow-page"
import { DEFAULT_CHARACTER } from "@/lib/character/catalog"
import { FAMILY_NAME_MAX_LENGTH } from "@/lib/family/config"
import { validateFamilyName, validateMemberName } from "@/lib/family/validate"

type Step = "name" | "character"

/**
 * 새 가족 만들기: 1) 가족 이름 → 2) 내 이름·캐릭터 → 저장하고 우리집 보기.
 * 만든 사람이 초기 관리자가 된다(역할과 별개). 모두 메모리 데모이며 실제 계정·저장은 없다.
 */
export function CreateFamilyScreen() {
  const router = useRouter()
  const { createFamily } = useFamily()
  const [step, setStep] = React.useState<Step>("name")
  const [familyName, setFamilyName] = React.useState("")
  const [familyError, setFamilyError] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState<CharacterDraft>({ name: "", avatar: DEFAULT_CHARACTER })
  const [nameError, setNameError] = React.useState<string | null>(null)
  const submittingRef = React.useRef(false)

  function next(e: React.FormEvent) {
    e.preventDefault()
    const err = validateFamilyName(familyName)
    setFamilyError(err)
    if (err) {
      document.getElementById("new-family-name")?.focus()
      return
    }
    setStep("character")
  }

  function finish() {
    if (submittingRef.current) return
    const err = validateMemberName(draft.name)
    setNameError(err)
    if (err) {
      document.getElementById("character-name")?.focus()
      return
    }
    submittingRef.current = true
    const result = createFamily(familyName, { name: draft.name.trim(), avatar: draft.avatar })
    if (!result) {
      submittingRef.current = false
      setNameError("가족을 만들지 못했어요. 입력을 확인해 주세요.")
      return
    }
    router.push("/home")
  }

  if (step === "name") {
    return (
      <FlowPage
        title="새 가족 만들기"
        back="/welcome"
        action={
          <Button size="lg" type="submit" form="new-family-form" disabled={familyName.trim() === ""}>
            가족 만들기
          </Button>
        }
      >
        <form id="new-family-form" onSubmit={next} noValidate className="flex flex-col gap-6 pt-4">
          <div className="flex flex-col gap-2">
            <StepLabel>1 / 2</StepLabel>
            <FlowHeading>
              우리 가족 공간에
              <br />
              이름을 붙여 주세요
            </FlowHeading>
            <FlowLead>가족 구성원 모두에게 같은 이름으로 보여요.</FlowLead>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-family-name" className="text-sm font-semibold text-muted-foreground">
              가족 이름
            </Label>
            <Input
              id="new-family-name"
              autoFocus
              value={familyName}
              maxLength={FAMILY_NAME_MAX_LENGTH}
              placeholder="예: 서로의 집"
              aria-invalid={familyError ? true : undefined}
              aria-describedby={familyError ? "new-family-name-error new-family-name-hint" : "new-family-name-hint"}
              onChange={(e) => {
                setFamilyName(e.target.value)
                setFamilyError(null)
              }}
            />
            <div className="flex items-start justify-between gap-3">
              {familyError ? (
                <p id="new-family-name-error" role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
                  <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                  {familyError}
                </p>
              ) : (
                <span />
              )}
              <p id="new-family-name-hint" className="shrink-0 text-sm text-muted-foreground tabular-nums">
                {Array.from(familyName).length} / {FAMILY_NAME_MAX_LENGTH}
              </p>
            </div>
          </div>
          <PrivacyNote icon={ShieldCheck}>가족을 만든 사람이 초기 관리자가 돼요. 역할(엄마·아빠)과 관리자 권한은 별개예요.</PrivacyNote>
        </form>
      </FlowPage>
    )
  }

  return (
    <FlowPage
      title="내 캐릭터"
      eyebrow="마지막 단계 · 2 / 2"
      back={() => setStep("name")}
      backLabel="가족 이름으로 돌아가기"
      action={
        <Button size="lg" onClick={finish}>
          저장하고 우리집 보기
        </Button>
      }
    >
      <p className="text-sm text-muted-foreground">‘{familyName.trim()}’에서 쓸 이름과 캐릭터를 골라 주세요. 나중에 더보기에서 바꿀 수 있어요.</p>
      <CharacterForm
        draft={draft}
        nameError={nameError}
        onChange={(patch) => {
          if ("name" in patch) setNameError(null)
          setDraft((d) => ({ ...d, ...patch, avatar: { ...d.avatar, ...(patch.avatar ?? {}) } }))
        }}
      />
    </FlowPage>
  )
}
