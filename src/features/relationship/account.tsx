"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Logo } from "@/components/logo"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Panel, PageFrame, useFamily, type FamilyState } from "./common"

export function AuthScreen() {
  const router = useRouter()
  const [signup, setSignup] = React.useState(false),
    [busy, setBusy] = React.useState(false),
    [error, setError] = React.useState("")
  const errorRef = React.useRef<HTMLParagraphElement>(null)
  React.useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    setBusy(true)
    setError("")
    try {
      const response = await fetch(
        `/api/auth/${signup ? "sign-up" : "sign-in"}/email`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: data.get("email"),
            password: data.get("password"),
            ...(signup ? { name: data.get("name") } : {}),
            callbackURL: "/home",
          }),
        }
      )
      if (!response.ok) {
        throw new Error(
          response.status === 429
            ? "잠시 후 다시 시도해 주세요."
            : signup
              ? "가입하지 못했어요. 이메일과 비밀번호를 확인해 주세요."
              : "이메일과 비밀번호를 확인해 주세요."
        )
      }
      router.replace("/home")
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "연결을 확인해 주세요.")
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-12">
      <div className="flex items-center gap-3">
        <Logo size={36} />
        <h1 className="text-3xl font-bold">우리집</h1>
      </div>
      <p className="text-muted-foreground">
        내 이야기를 정리하고, 가족과 함께 일정을 맞춰요.
      </p>
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">
            {signup ? "계정 만들기" : "로그인"}
          </h2>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={submit}>
            {error && (
              <p
                ref={errorRef}
                tabIndex={-1}
                role="alert"
                className="text-sm text-destructive"
              >
                {error}
              </p>
            )}
            {signup && (
              <label className="space-y-2">
                이름
                <Input
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={80}
                  disabled={busy}
                />
              </label>
            )}
            <label className="space-y-2">
              이메일
              <Input
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={busy}
              />
            </label>
            <label className="space-y-2">
              비밀번호
              <Input
                name="password"
                type="password"
                autoComplete={signup ? "new-password" : "current-password"}
                minLength={12}
                maxLength={128}
                required
                disabled={busy}
              />
            </label>
            {signup && (
              <p className="text-sm text-muted-foreground">
                비밀번호는 12자 이상으로 입력해 주세요.
              </p>
            )}
            <Button type="submit" disabled={busy} aria-busy={busy}>
              {busy ? "확인하는 중" : signup ? "계정 만들기" : "로그인"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setSignup(!signup)
                setError("")
              }}
            >
              {signup ? "이미 계정이 있어요" : "처음이에요 · 계정 만들기"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
export function HouseholdSetup({ state }: { state: FamilyState }) {
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    await state.run(
      { type: "household.create", name: String(data.get("familyName")) },
      "우리집을 만들었어요. 초대 코드를 가족에게 전달해 주세요."
    )
  }
  async function join(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    await state.run(
      {
        type: "household.join",
        inviteCode: String(data.get("inviteCode")).trim(),
      },
      "가족에 참여했어요."
    )
  }
  return (
    <>
      <Panel
        title="우리 가족의 공간 만들기"
        description="먼저 가족 공간을 만들거나, 받은 초대 코드로 참여해 주세요."
      >
        <form className="space-y-3" onSubmit={create}>
          <label className="block space-y-2">
            가족 이름
            <Input
              name="familyName"
              required
              maxLength={80}
              disabled={state.busy}
            />
          </label>
          <Button type="submit" disabled={state.busy}>
            우리집 만들기
          </Button>
        </form>
      </Panel>
      <Panel title="초대받았어요">
        <form className="space-y-3" onSubmit={join}>
          <label className="block space-y-2">
            초대 코드
            <Input
              name="inviteCode"
              required
              minLength={16}
              maxLength={128}
              autoComplete="off"
              disabled={state.busy}
            />
          </label>
          <Button type="submit" variant="secondary" disabled={state.busy}>
            가족에 참여하기
          </Button>
        </form>
      </Panel>
    </>
  )
}
export function AccountScreen() {
  const router = useRouter()
  const state = useFamily(),
    [authError, setAuthError] = React.useState("")
  async function logout() {
    try {
      const r = await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
      if (!r.ok) throw new Error()
      router.replace("/login")
      router.refresh()
    } catch {
      setAuthError("로그아웃하지 못했어요. 다시 시도해 주세요.")
    }
  }
  return (
    <PageFrame title="더보기" state={state}>
      {state.view && (
        <>
          <Panel
            title={state.view.viewer.name}
            description={state.view.viewer.email}
          >
            {authError && (
              <p role="alert" className="text-destructive">
                {authError}
              </p>
            )}
            <Button variant="secondary" onClick={() => void logout()}>
              로그아웃
            </Button>
          </Panel>
          {!state.view.household ? (
            <HouseholdSetup state={state} />
          ) : (
            <>
              <Panel
                title={state.view.household.name}
                description="이 코드를 받은 사람이 가족에 참여할 수 있어요. 원하는 가족에게만 전달해 주세요."
              >
                <label className="space-y-2">
                  가족 초대 코드
                  <Input
                    readOnly
                    value={state.view.household.inviteCode}
                    onFocus={(e) => e.target.select()}
                  />
                </label>
                <h3 className="mt-2 font-semibold">함께하는 가족</h3>
                <ul className="space-y-2">
                  {state.view.members.map((m) => (
                    <li key={m.id}>
                      {m.name}
                      {m.id === state.view?.viewer.id ? " (나)" : ""}
                    </li>
                  ))}
                </ul>
              </Panel>
              <Button asChild variant="secondary">
                <Link href="/home/heart">마음 전하기와 조율 내역</Link>
              </Button>
            </>
          )}
        </>
      )}
    </PageFrame>
  )
}
