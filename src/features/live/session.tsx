"use client"
import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import type { Family, FamilyMember } from "@/lib/home.fixture"
import { api, ApiError } from "./client"
type Session = { viewer: { id: string; name: string }; family: Family | null }
const Context = React.createContext<{
  session: Session
  reload: () => Promise<void>
  logout: () => Promise<void>
} | null>(null)
export function LiveGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null),
    [loading, setLoading] = React.useState(true),
    [error, setError] = React.useState(""),
    [busy, setBusy] = React.useState(false),
    [signup, setSignup] = React.useState(false)
  const [name, setName] = React.useState(""),
    [email, setEmail] = React.useState(""),
    [password, setPassword] = React.useState(""),
    [familyName, setFamilyName] = React.useState(""),
    [invite, setInvite] = React.useState("")
  async function reload() {
    try {
      setSession(await api<Session>("session"))
      setError("")
    } catch (e) {
      setSession(null)
      if (!(e instanceof ApiError && e.status === 401))
        setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }
  React.useEffect(() => {
    // Network response updates state asynchronously; this effect subscribes to external data.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
    const expire = () => {
      setSession(null)
      setPassword("")
      setError("로그인이 만료됐어요. 다시 로그인해 주세요.")
    }
    window.addEventListener("session-expired", expire)
    const focus = () => {
      void reload()
    }
    window.addEventListener("focus", focus)
    return () => {
      window.removeEventListener("session-expired", expire)
      window.removeEventListener("focus", focus)
    }
  }, [])
  async function logout() {
    setBusy(true)
    try {
      const r = await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
      if (!r.ok) throw new Error("로그아웃하지 못했어요.")
      setSession(null)
      setPassword("")
      setInvite("")
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function auth(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError("")
    try {
      const r = await fetch(
        "/api/auth/" + (signup ? "sign-up/email" : "sign-in/email"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            ...(signup ? { name } : {}),
          }),
        }
      )
      if (!r.ok) {
        const d = await r.json()
        throw new Error(d.message || "로그인 정보를 확인해 주세요.")
      }
      setPassword("")
      await reload()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const familyKey = React.useRef<{ body: string; key: string } | null>(null)
  async function family(join: boolean) {
    if (busy) return
    setBusy(true)
    setError("")
    const body = JSON.stringify(
      join ? { inviteCode: invite } : { name: familyName }
    )
    if (familyKey.current?.body !== body)
      familyKey.current = { body, key: crypto.randomUUID() }
    try {
      await api(join ? "family/join" : "families", "POST", {
        ...JSON.parse(body),
        requestId: familyKey.current.key,
      })
      await reload()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  if (loading)
    return (
      <p role="status" className="p-6">
        로그인 상태를 확인하는 중이에요.
      </p>
    )
  if (!session)
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 p-6">
        <h1 className="text-3xl font-bold">우리집</h1>
        <Card className="p-5">
          <form onSubmit={auth} className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold">
              {signup ? "계정 만들기" : "로그인"}
            </h2>
            {signup && (
              <label>
                이름
                <Input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </label>
            )}
            <label>
              이메일
              <Input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </label>
            <label>
              비밀번호
              <Input
                required
                type="password"
                minLength={12}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={signup ? "new-password" : "current-password"}
              />
            </label>
            <p className="text-sm text-muted-foreground">
              비밀번호는 12자 이상으로 입력해 주세요.
            </p>
            {error && <p role="alert">{error}</p>}
            {error && (
              <Button
                variant="outline"
                type="button"
                onClick={() => void reload()}
              >
                연결 다시 확인
              </Button>
            )}
            <Button disabled={busy} type="submit">
              {busy ? "확인 중…" : signup ? "계정 만들기" : "로그인"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSignup(!signup)}
            >
              {signup ? "이미 계정이 있어요" : "처음 방문했어요"}
            </Button>
          </form>
        </Card>
      </main>
    )
  if (!session.family)
    return (
      <main className="mx-auto flex max-w-md flex-col gap-5 p-6">
        <h1 className="text-2xl font-bold">가족 공간에 참여하기</h1>
        <label>
          가족 이름
          <Input
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
          />
        </label>
        <Button
          disabled={busy || !familyName.trim()}
          onClick={() => void family(false)}
        >
          가족 공간 만들기
        </Button>
        <label>
          초대 코드
          <Input value={invite} onChange={(e) => setInvite(e.target.value)} />
        </label>
        <Button
          disabled={busy || !invite.trim()}
          onClick={() => void family(true)}
        >
          초대 코드로 참여
        </Button>
        {error && <p role="alert">{error}</p>}
        <Button variant="ghost" disabled={busy} onClick={() => void logout()}>
          로그아웃
        </Button>
      </main>
    )
  return (
    <Context.Provider value={{ session, reload, logout }}>
      <React.Fragment key={session.viewer.id}>
        {error && (
          <p role="alert" className="mx-auto max-w-md p-4">
            {error}
          </p>
        )}
        {children}
      </React.Fragment>
    </Context.Provider>
  )
}
export function useDemoViewer() {
  const c = React.useContext(Context)
  if (!c?.session.family) throw new Error("가족 로그인이 필요해요.")
  const family = c.session.family
  const viewer = family.members.find(
    (m) => m.id === c.session.viewer.id
  ) as FamilyMember
  return {
    family,
    viewer,
    viewerId: c.session.viewer.id,
    setViewerId: (_id: string) => {},
  }
}
export function DemoViewerProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
export function LiveAccount() {
  const c = React.useContext(Context)
  const [code, setCode] = React.useState(""),
    [error, setError] = React.useState(""),
    [busy, setBusy] = React.useState(false)
  if (!c) return null
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">
        {c.session.viewer.name}님의 가족
      </h2>
      <p>{c.session.family?.name}</p>
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            const r = await api<{ inviteCode: string }>(
              "family/invites",
              "POST",
              { requestId: crypto.randomUUID() }
            )
            setCode(r.inviteCode)
          } catch (e) {
            setError((e as Error).message)
          } finally {
            setBusy(false)
          }
        }}
      >
        가족 초대 코드 만들기
      </Button>
      {code && (
        <div>
          <p className="text-sm">24시간 동안 사용할 수 있는 초대 코드예요.</p>
          <code className="break-all select-all">{code}</code>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      <Button variant="outline" onClick={() => void c.logout()}>
        로그아웃
      </Button>
    </section>
  )
}
