"use client"
import * as React from "react"
import { Button } from "@/components/ui/button"
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown
): Promise<T> {
  const res = await fetch("/api/v2/" + path, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers:
      body instanceof FormData
        ? undefined
        : { "Content-Type": "application/json" },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  })
  const result = await res.json()
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event("session-expired"))
    throw new ApiError(
      res.status,
      result.error?.message || "요청을 완료하지 못했어요. 다시 시도해 주세요."
    )
  }
  return result.data
}
export function useResource<T>(path: string, initial: T) {
  const [data, setData] = React.useState(initial),
    [loading, setLoading] = React.useState(true),
    [error, setError] = React.useState(""),
    [busy, setBusy] = React.useState(false)
  const pending = React.useRef(false),
    keys = React.useRef(new Map<string, string>())
  const refresh = React.useCallback(async () => {
    try {
      setData(await api<T>(path))
      setError("")
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    } finally {
      setLoading(false)
    }
  }, [path])
  React.useEffect(() => {
    // Network response updates state asynchronously; this effect subscribes to external data.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
    const run = () => {
      void refresh()
    }
    window.addEventListener("focus", run)
    return () => window.removeEventListener("focus", run)
  }, [refresh])
  async function mutate<R>(
    target: string,
    method: string,
    body: Record<string, unknown>,
    token?: string
  ): Promise<R | null> {
    if (pending.current) return null
    pending.current = true
    setBusy(true)
    setError("")
    const signature = JSON.stringify([target, method, body])
    const requestId =
      token || keys.current.get(signature) || crypto.randomUUID()
    keys.current.set(signature, requestId)
    try {
      const result = await api<R>(target, method, { ...body, requestId })
      keys.current.delete(signature)
      await refresh()
      return result
    } catch (e) {
      setError((e as Error).message)
      if (e instanceof ApiError && e.status === 409) {
        keys.current.delete(signature)
        await refresh()
        setError("내용이 변경됐어요. 최신 내용을 확인하고 다시 시도해 주세요.")
      }
      return null
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  return { data, setData, loading, error, setError, busy, refresh, mutate }
}
export function ResourceState({
  loading,
  error,
  busy,
  retry,
  children,
}: {
  loading: boolean
  error: string
  busy?: boolean
  retry: () => unknown
  children: React.ReactNode
}) {
  if (loading)
    return (
      <div role="status" className="mx-auto max-w-md p-6">
        가족 정보를 불러오는 중이에요.
      </div>
    )
  return (
    <>
      <div className="mx-auto max-w-md px-4" aria-live="polite">
        {busy && <p role="status">저장하는 중이에요.</p>}
        {error && (
          <div role="alert" className="rounded-md border p-3">
            <p>{error}</p>
            <Button variant="outline" onClick={() => void retry()}>
              다시 불러오기
            </Button>
          </div>
        )}
      </div>
      {children}
    </>
  )
}
