"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, House, Loader2, LockKeyhole } from "lucide-react"

import { CharacterForm, type CharacterDraft } from "@/components/character/character-form"
import { useOnboarding } from "@/components/family/family-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FlowHeading, FlowLead, FlowPage, PrivacyNote, StepLabel } from "@/components/woorijip/flow-page"
import { MemberStack } from "@/components/woorijip/member"
import { DEFAULT_CHARACTER } from "@/lib/character/catalog"
import { INVITE_CODE_LENGTH } from "@/lib/family/config"
import { DEMO_EXPIRED_CODE, type InviteLookup } from "@/lib/family/invite-adapter"
import { normalizeInviteCode, validateMemberName } from "@/lib/family/validate"

type Step = "code" | "confirm" | "character"
type Lookup = { phase: "idle" } | { phase: "loading" } | { phase: "done"; result: InviteLookup }

const ERROR_TEXT: Record<Exclude<InviteLookup["status"], "ok">, string> = {
  "not-found": "코드를 다시 확인해 주세요. 존재하지 않는 코드예요.",
  expired: "만료된 코드예요. 가족 관리자에게 새 코드를 받아 주세요.",
  "already-member": "지금 보고 있는 가족의 코드예요. 이미 참여하고 있어요.",
  error: "코드를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.",
}

/**
 * 초대코드로 참여.
 * - 데모: 코드 조회(지연·오류·만료·이미 참여 구분) → 가족 확인 → 내 이름·캐릭터 → 참여.
 * - 라이브: 서버가 코드를 미리 조회하는 API를 주지 않으므로 코드 → 내 이름·캐릭터 → 참여 요청(서버가 코드 검증)으로 간다.
 * 초대코드는 참여할 가족을 찾는 코드일 뿐 로그인이 아니다.
 */
export function JoinFamilyScreen({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter()
  const { mode, currentFamily, inviteAdapter, supportsLookup, demoCodes, joinFamily, lastError } = useOnboarding()
  const [step, setStep] = React.useState<Step>("code")
  const [code, setCode] = React.useState(supportsLookup ? normalizeInviteCode(initialCode) : initialCode.trim())
  const [lookup, setLookup] = React.useState<Lookup>({ phase: "idle" })
  const [draft, setDraft] = React.useState<CharacterDraft>({ name: "", avatar: DEFAULT_CHARACTER })
  const [nameError, setNameError] = React.useState<string | null>(null)
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const abortRef = React.useRef<AbortController | null>(null)
  const submittingRef = React.useRef(false)

  React.useEffect(() => () => abortRef.current?.abort(), [])

  const found = lookup.phase === "done" && lookup.result.status === "ok" ? lookup.result.family : null
  const errorStatus = lookup.phase === "done" && lookup.result.status !== "ok" ? lookup.result.status : null
  const trimmedCode = supportsLookup ? normalizeInviteCode(code) : code.trim()

  async function submitCode(e?: React.FormEvent) {
    e?.preventDefault()
    if (trimmedCode.length === 0) return
    if (!supportsLookup) {
      // 라이브: 조회 없이 캐릭터 단계로. 코드는 참여 요청 때 서버가 검증한다.
      setSubmitError(null)
      setStep("character")
      return
    }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLookup({ phase: "loading" })
    try {
      const result = await inviteAdapter.lookup(trimmedCode, controller.signal)
      if (controller.signal.aborted) return
      setLookup({ phase: "done", result })
      if (result.status === "ok") setStep("confirm")
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return
      setLookup({ phase: "done", result: { status: "error", message: "lookup failed" } })
    }
  }

  async function finish() {
    if (submittingRef.current) return
    const err = validateMemberName(draft.name)
    setNameError(err)
    if (err) {
      document.getElementById("character-name")?.focus()
      return
    }
    submittingRef.current = true
    setBusy(true)
    setSubmitError(null)
    const result = await joinFamily(trimmedCode, { name: draft.name.trim(), avatar: draft.avatar })
    submittingRef.current = false
    setBusy(false)
    if (!result) {
      setSubmitError(lastError ?? "참여하지 못했어요. 코드를 다시 확인해 주세요.")
      return
    }
    router.push("/home")
  }

  if (step === "code") {
    const loading = lookup.phase === "loading"
    return (
      <FlowPage
        title="가족 공간 참여"
        back="/welcome"
        action={
          <Button size="lg" type="submit" form="join-form" disabled={loading || trimmedCode.length === 0} aria-busy={loading}>
            {loading ? (
              <>
                <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />
                코드를 확인하는 중
              </>
            ) : supportsLookup ? (
              "코드 확인"
            ) : (
              "다음: 내 캐릭터"
            )}
          </Button>
        }
      >
        <form id="join-form" onSubmit={submitCode} noValidate className="flex flex-col gap-6 pt-4">
          <div className="flex flex-col gap-2">
            <StepLabel>초대코드</StepLabel>
            <FlowHeading>
              가족에게 받은 코드를
              <br />
              입력해 주세요
            </FlowHeading>
            <FlowLead>초대코드는 로그인 수단이 아니라 참여할 가족을 찾는 코드예요.</FlowLead>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite-code" className="text-sm font-semibold text-muted-foreground">
              초대코드
            </Label>
            <Input
              id="invite-code"
              autoFocus
              value={code}
              maxLength={supportsLookup ? INVITE_CODE_LENGTH + 2 : 128}
              autoCapitalize={supportsLookup ? "characters" : "none"}
              autoComplete="one-time-code"
              spellCheck={false}
              placeholder={supportsLookup ? "예: ABC123" : "초대받은 코드를 붙여 넣어 주세요"}
              className={supportsLookup ? "font-display text-xl tracking-[0.15em] uppercase" : "font-mono text-sm"}
              aria-invalid={errorStatus ? true : undefined}
              aria-describedby={errorStatus ? "invite-code-error" : "invite-code-hint"}
              onChange={(e) => {
                setCode(supportsLookup ? e.target.value.toUpperCase() : e.target.value)
                if (lookup.phase === "done") setLookup({ phase: "idle" })
              }}
            />
            {errorStatus ? (
              <p id="invite-code-error" role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {ERROR_TEXT[errorStatus]}
              </p>
            ) : (
              <p id="invite-code-hint" className="text-sm text-muted-foreground">
                {supportsLookup ? `영문·숫자 ${INVITE_CODE_LENGTH}자리. 대소문자는 구분하지 않아요.` : "가족 관리자가 만든 코드는 24시간 동안 쓸 수 있어요. 참여를 요청할 때 서버가 확인해요."}
              </p>
            )}
          </div>
          {mode === "demo" && (
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <p className="text-xs font-semibold text-muted-foreground">프로토타입 체험 코드 (데모 가족)</p>
              <div className="flex flex-wrap gap-2">
                {demoCodes.map((d) => (
                  <Button key={d.code} type="button" variant="outline" className="h-10 font-display tracking-wider" onClick={() => setCode(d.code)}>
                    {d.code}
                    <span className="font-sans text-xs tracking-normal text-muted-foreground">{d.name}</span>
                  </Button>
                ))}
                <Button type="button" variant="ghost" className="h-10 font-display tracking-wider" onClick={() => setCode(DEMO_EXPIRED_CODE)}>
                  {DEMO_EXPIRED_CODE}
                  <span className="font-sans text-xs tracking-normal text-muted-foreground">만료 예시</span>
                </Button>
              </div>
              {demoCodes.length === 0 && currentFamily?.inviteCode && (
                <p className="text-xs text-muted-foreground">다른 데모 가족이 없어요. 현재 가족 코드({currentFamily.inviteCode})는 ‘이미 참여함’으로 안내돼요.</p>
              )}
            </div>
          )}
        </form>
      </FlowPage>
    )
  }

  if (step === "confirm" && found) {
    const others = found.members.length - 1
    return (
      <FlowPage
        title="가족 확인"
        back={() => setStep("code")}
        backLabel="코드 입력으로 돌아가기"
        action={
          <>
            <Button size="lg" onClick={() => setStep("character")}>
              참여하고 계속하기
            </Button>
            <Button variant="link" className="h-11" onClick={() => setStep("code")}>
              다른 코드 입력
            </Button>
          </>
        }
      >
        <div className="flex flex-col items-center gap-3 pt-6 text-center">
          <span className="flex size-19 items-center justify-center rounded-full bg-secondary text-primary">
            <House className="size-8" aria-hidden="true" />
          </span>
          <StepLabel>초대받은 가족</StepLabel>
          <FlowHeading>‘{found.name}’이 맞나요?</FlowHeading>
          <div className="pt-2">
            <MemberStack members={found.members} max={3} />
          </div>
          <FlowLead>
            {found.adminName} 님{others > 0 ? ` 외 ${others}명` : ""}이 함께하고 있어요.
          </FlowLead>
          <PrivacyNote icon={LockKeyhole} className="w-full text-left">
            참여 후에도 다른 구성원의 개인 원문·초안은 누구에게도 공개되지 않아요. 참여는 로그인이 아니라 가족 공간에 들어가는 절차예요.
          </PrivacyNote>
        </div>
      </FlowPage>
    )
  }

  return (
    <FlowPage
      title="내 캐릭터"
      eyebrow="마지막 단계"
      back={() => setStep(supportsLookup ? "confirm" : "code")}
      backLabel={supportsLookup ? "가족 확인으로 돌아가기" : "코드 입력으로 돌아가기"}
      action={
        <>
          {submitError && (
            <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {submitError}
            </p>
          )}
          <Button size="lg" onClick={finish} disabled={busy} aria-busy={busy}>
            {busy ? (
              <>
                <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />
                참여하는 중
              </>
            ) : (
              "저장하고 우리집 보기"
            )}
          </Button>
          {submitError && !supportsLookup && (
            <Button variant="link" className="h-11" onClick={() => setStep("code")}>
              코드 다시 입력
            </Button>
          )}
        </>
      }
    >
      <p className="text-sm text-muted-foreground">{found ? `‘${found.name}’에서` : "참여할 가족에서"} 쓸 이름과 캐릭터를 골라 주세요. 나중에 더보기에서 바꿀 수 있어요.</p>
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
