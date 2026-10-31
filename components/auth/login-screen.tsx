"use client"

import * as React from "react"
import Link from "next/link"
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react"

import { useSession } from "@/components/family/live-session"
import { BRAND_NAME } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FlowHeading, FlowLead, FlowPage, PrivacyNote, StepLabel } from "@/components/woorijip/flow-page"
import { MEMBER_NAME_MAX_LENGTH } from "@/lib/family/config"

const PASSWORD_MIN = 12

/** Better Auth가 돌려주는 영문 메시지를 사용자 문구로 바꾼다. 모르는 메시지는 그대로 보여 준다. */
function localizeAuthError(message: string) {
  const m = message.toLowerCase()
  if (m.includes("invalid email or password") || m.includes("invalid password")) return "이메일 또는 비밀번호가 맞지 않아요."
  if (m.includes("already exists") || m.includes("already registered")) return "이미 가입된 이메일이에요. 로그인해 주세요."
  if (m.includes("password too short") || m.includes("at least")) return `비밀번호는 ${PASSWORD_MIN}자 이상이어야 해요.`
  if (m.includes("invalid email")) return "이메일 형식을 확인해 주세요."
  return message
}

/**
 * 이메일·비밀번호 로그인/계정 만들기(Better Auth). 브라우저에 토큰을 저장하지 않고 서버 세션 쿠키만 쓴다.
 * 세션이 확인되면 FamilyScope가 /home 또는 /welcome으로 보낸다.
 */
export function LoginScreen() {
  const session = useSession()
  const [mode, setMode] = React.useState<"signin" | "signup">("signin")
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  if (!session) {
    return (
      <FlowPage title="로그인">
        <PrivacyNote>데모 모드에서는 로그인이 없어요. 홈으로 돌아가 데모 인물 전환을 써 주세요.</PrivacyNote>
        <Button asChild>
          <Link href="/home">홈으로</Link>
        </Button>
      </FlowPage>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    const message =
      mode === "signup" ? await session!.signUp(name.trim(), email.trim(), password) : await session!.signIn(email.trim(), password)
    setBusy(false)
    if (message) {
      setError(localizeAuthError(message))
      return
    }
    setPassword("")
  }

  const signup = mode === "signup"
  const canSubmit = email.trim() !== "" && password.length >= PASSWORD_MIN && (!signup || name.trim() !== "")

  return (
    <FlowPage
      title={signup ? "계정 만들기" : "로그인"}
      action={
        <>
          <Button size="lg" type="submit" form="login-form" disabled={!canSubmit || busy} aria-busy={busy}>
            {busy ? (
              <>
                <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />
                확인하는 중
              </>
            ) : signup ? (
              "계정 만들기"
            ) : (
              "로그인"
            )}
          </Button>
          <Button
            variant="link"
            className="h-11"
            type="button"
            onClick={() => {
              setMode(signup ? "signin" : "signup")
              setError(null)
            }}
          >
            {signup ? "이미 계정이 있어요 · 로그인" : "처음 방문했어요 · 계정 만들기"}
          </Button>
        </>
      }
    >
      <form id="login-form" onSubmit={submit} noValidate className="flex flex-col gap-6 pt-4">
        <div className="flex flex-col gap-2">
          <StepLabel>{BRAND_NAME}</StepLabel>
          <FlowHeading>
            {signup ? (
              <>
                가족 공간에 쓸
                <br />
                계정을 만들어요
              </>
            ) : (
              <>
                다시 만나서
                <br />
                반가워요
              </>
            )}
          </FlowHeading>
          <FlowLead>{signup ? "이메일과 비밀번호로 계정을 만든 뒤 가족을 만들거나 초대코드로 참여해요." : "이메일과 비밀번호로 로그인해요."}</FlowLead>
        </div>

        {signup && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="login-name" className="text-sm font-semibold text-muted-foreground">
              이름
            </Label>
            <Input id="login-name" value={name} maxLength={MEMBER_NAME_MAX_LENGTH} autoComplete="name" onChange={(e) => setName(e.target.value)} />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="login-email" className="text-sm font-semibold text-muted-foreground">
            이메일
          </Label>
          <Input id="login-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="login-password" className="text-sm font-semibold text-muted-foreground">
            비밀번호
          </Label>
          <Input
            id="login-password"
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            value={password}
            aria-describedby="login-password-hint"
            onChange={(e) => setPassword(e.target.value)}
          />
          <p id="login-password-hint" className="text-sm text-muted-foreground">
            {PASSWORD_MIN}자 이상으로 입력해 주세요.
          </p>
        </div>

        {(error || session.error) && (
          <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {error ?? session.error}
          </p>
        )}
        {session.error && (
          <Button type="button" variant="outline" onClick={() => void session.reload()}>
            연결 다시 확인
          </Button>
        )}
        <PrivacyNote icon={ShieldCheck}>로그인 정보는 서버 세션으로만 유지되고 이 기기에 토큰을 저장하지 않아요.</PrivacyNote>
      </form>
    </FlowPage>
  )
}
