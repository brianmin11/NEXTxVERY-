"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, LoaderCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { AppShell } from "@/components/woorijip/app-shell"
import { ErrorState } from "@/components/woorijip/state-views"
import { formatFullDate, formatTime } from "@/lib/format"
import type {
  Command,
  CommandResult,
  FamilyView,
  Member,
} from "@/src/contracts/family"

export type CommandInput = Command extends infer C
  ? C extends { requestId: string }
    ? Omit<C, "requestId">
    : never
  : never
export function useFamily() {
  const router = useRouter()
  const [view, setView] = React.useState<FamilyView | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState("")
  const [notice, setNotice] = React.useState("")
  const inflight = React.useRef(false)
  const retry = React.useRef<{ body: string; requestId: string } | null>(null)
  const load = React.useCallback(
    () =>
      fetch("/api/family", { cache: "no-store" })
        .then(async (response) => {
          if (response.status === 401) {
            router.replace("/login")
            return
          }
          const data = await response.json()
          if (!response.ok)
            throw new Error(data.error?.message || "내용을 불러오지 못했어요.")
          setView(data)
        })
        .catch((error) =>
          setError(
            error instanceof Error
              ? error.message
              : "연결을 확인한 뒤 다시 불러와 주세요."
          )
        )
        .finally(() => setLoading(false)),
    [router]
  )
  const reload = React.useCallback(async () => {
    setLoading(true)
    setError("")
    await load()
  }, [load])
  React.useEffect(() => {
    void load()
  }, [load])
  const run = React.useCallback(
    async (command: CommandInput, success = "저장했어요.") => {
      if (inflight.current) return null
      inflight.current = true
      setBusy(true)
      setError("")
      setNotice("")
      const body = JSON.stringify(command)
      const requestId =
        retry.current?.body === body
          ? retry.current.requestId
          : crypto.randomUUID()
      retry.current = { body, requestId }
      try {
        const response = await fetch("/api/family", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...command, requestId }),
        })
        if (response.status === 401) {
          router.replace("/login")
          return null
        }
        const data = await response.json()
        if (!response.ok) {
          retry.current = null
          throw new Error(
            data.error?.message || "처리하지 못했어요. 내용을 확인해 주세요."
          )
        }
        const result = data as CommandResult
        retry.current = null
        setView(result.view)
        setNotice(success)
        return result
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "연결이 끊겼어요. 같은 요청을 다시 시도할 수 있어요."
        )
        return null
      } finally {
        inflight.current = false
        setBusy(false)
      }
    },
    [router]
  )
  return { view, loading, busy, error, notice, reload, run, setError }
}
export type FamilyState = ReturnType<typeof useFamily>
export function PageFrame({
  title,
  state,
  children,
}: {
  title: string
  state: FamilyState
  children: React.ReactNode
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (state.error) ref.current?.focus()
  }, [state.error])
  return (
    <AppShell
      title={
        <>
          <Button asChild variant="ghost" size="icon">
            <Link href="/home" aria-label="우리집으로 돌아가기">
              <ArrowLeft aria-hidden="true" />
            </Link>
          </Button>
          <h1 className="text-lg font-bold">{title}</h1>
        </>
      }
      actions={
        <Button
          variant="ghost"
          size="icon"
          disabled={state.busy || state.loading}
          aria-label="새로고침"
          onClick={() => void state.reload()}
        >
          <RefreshCw aria-hidden="true" />
        </Button>
      }
    >
      {state.error && (
        <div ref={ref} tabIndex={-1} className="scroll-mt-20 outline-none">
          <ErrorState
            title="완료하지 못했어요"
            description={state.error}
            action={
              <Button
                variant="secondary"
                onClick={() => void state.reload()}
                disabled={state.busy}
              >
                최신 내용 확인
              </Button>
            }
          />
        </div>
      )}
      {state.notice && (
        <p role="status" className="rounded-md bg-secondary px-4 py-3 text-sm">
          {state.notice}
        </p>
      )}
      {state.busy && (
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <LoaderCircle
            className="size-4 motion-safe:animate-spin"
            aria-hidden="true"
          />
          처리 중이에요. 잠시 기다려 주세요.
        </p>
      )}
      {state.loading && !state.view ? (
        <div
          aria-label="내용 불러오는 중"
          aria-busy="true"
          className="space-y-4"
        >
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        children
      )}
    </AppShell>
  )
}
export function Panel({
  title,
  description,
  children,
  ...props
}: {
  title: string
  description?: string
  children: React.ReactNode
} & React.ComponentProps<"section">) {
  return (
    <section {...props}>
      <Card>
        <CardHeader>
          <h2 className="text-lg font-bold">{title}</h2>
          {description && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </section>
  )
}
export function TextArea(props: React.ComponentProps<"textarea">) {
  return (
    <textarea
      {...props}
      className={`min-h-32 w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-base leading-relaxed transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 ${props.className || ""}`}
    />
  )
}
export const selectClass =
  "h-11 w-full min-w-0 rounded-md border border-input bg-card px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
export function Members({
  members,
  selected,
  onChange,
  disabled,
  legend = "함께하는 사람",
}: {
  members: Member[]
  selected: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
  legend?: string
}) {
  return (
    <fieldset disabled={disabled} className="flex flex-col gap-1">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      {members.map((m) => (
        <label
          key={m.id}
          className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-muted"
        >
          <input
            type="checkbox"
            className="size-5 accent-primary focus-visible:outline-2 focus-visible:outline-ring"
            checked={selected.includes(m.id)}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? [...selected, m.id]
                  : selected.filter((id) => id !== m.id)
              )
            }
          />
          <span>{m.name}</span>
        </label>
      ))}
    </fieldset>
  )
}
export function memberNames(ids: string[], view: FamilyView) {
  return ids
    .map((id) => view.members.find((m) => m.id === id)?.name || "구성원")
    .join(", ")
}
export function dateRange(start: string, end: string) {
  return `${formatFullDate(new Date(start))} ${formatTime(new Date(start))} – ${toInputDate(start).slice(0, 10) !== toInputDate(end).slice(0, 10) ? formatFullDate(new Date(end)) + " " : ""}${formatTime(new Date(end))}`
}
export function toInputDate(value: string) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value))
  return parts.replace(" ", "T")
}
export function fromInputDate(value: string) {
  return new Date(`${value}:00+09:00`).toISOString()
}
