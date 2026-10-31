"use client"

import * as React from "react"

import type { CharacterConfig } from "@/lib/character/catalog"
import type { InviteAdapter } from "@/lib/family/invite-adapter"
import { isFamilyAdmin, type Family, type FamilyMember } from "@/lib/family/types"
import { validateFamilyName, validateMemberName } from "@/lib/family/validate"
import { clampSpot, defaultSpot, type SceneSpot } from "@/lib/scene/spots"
import { api, ApiError } from "@/src/features/live/client"

import { FamilyContext, OnboardingContext, type FamilyContextValue, type OnboardingContextValue } from "./family-context"

/** 서버 `GET /api/v2/session` 응답(공개 필드만) */
export type LiveSession = {
  viewer: { id: string; name: string }
  family: Family | null
}

export type SessionStatus = "loading" | "unauthenticated" | "no-family" | "ready"

type SessionContextValue = {
  status: SessionStatus
  session: LiveSession | null
  /** 세션 조회 자체가 실패했을 때(네트워크·서버) */
  error: string | null
  reload: () => Promise<void>
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (name: string, email: string, password: string) => Promise<string | null>
  logout: () => Promise<void>
}

const SessionContext = React.createContext<SessionContextValue | null>(null)

const noLookup: InviteAdapter = {
  isDemo: false,
  lookup: async () => ({ status: "error", message: "라이브 모드에서는 코드를 미리 조회하지 않아요. 참여 요청으로 확인해요." }),
}

async function authPost(path: string, body: Record<string, unknown>) {
  const r = await fetch(`/api/auth/${path}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    let message = "요청을 완료하지 못했어요. 다시 시도해 주세요."
    try {
      const d = await r.json()
      message = d?.message || d?.error?.message || message
    } catch {
      /* 본문 없음 */
    }
    return message
  }
  return null
}

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "요청을 완료하지 못했어요. 다시 시도해 주세요."
}

/**
 * 라이브 모드: Better Auth 세션 쿠키와 `/api/v2/session`으로 현재 사용자·가족을 읽는다.
 * 세션이 바뀌면(로그인·로그아웃·가족 참여) 가족 단위 provider는 FamilyScope에서 가족 id로 다시 마운트된다.
 * 브라우저에 토큰을 저장하지 않고, API 실패를 데모 데이터로 대체하지 않는다.
 */
export function LiveFamilyProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<LiveSession | null>(null)
  const [status, setStatus] = React.useState<SessionStatus>("loading")
  const [error, setError] = React.useState<string | null>(null)
  const [lastError, setLastError] = React.useState<string | null>(null)
  const [spots, setSpots] = React.useState<Record<string, SceneSpot>>({})

  const reload = React.useCallback(async () => {
    try {
      const s = await api<LiveSession>("session")
      setSession(s)
      setStatus(s.family ? "ready" : "no-family")
      setError(null)
    } catch (e) {
      setSession(null)
      if (e instanceof ApiError && e.status === 401) {
        setStatus("unauthenticated")
        setError(null)
      } else {
        setStatus("unauthenticated")
        setError(errorMessage(e))
      }
    }
  }, [])

  React.useEffect(() => {
    // 세션은 외부(서버 쿠키) 상태라 마운트 때 한 번 읽고, 만료 이벤트·탭 복귀 때 다시 읽는다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
    const expire = () => {
      setSession(null)
      setStatus("unauthenticated")
      setError("로그인이 만료됐어요. 다시 로그인해 주세요.")
    }
    const focus = () => void reload()
    window.addEventListener("session-expired", expire)
    window.addEventListener("focus", focus)
    return () => {
      window.removeEventListener("session-expired", expire)
      window.removeEventListener("focus", focus)
    }
  }, [reload])

  const logout = React.useCallback(async () => {
    const message = await authPost("sign-out", {})
    if (message) {
      setLastError(message)
      return
    }
    setSession(null)
    setSpots({})
    setStatus("unauthenticated")
  }, [])

  const sessionValue = React.useMemo<SessionContextValue>(
    () => ({
      status,
      session,
      error,
      reload,
      logout,
      signIn: async (email, password) => {
        const message = await authPost("sign-in/email", { email, password })
        if (message) return message
        await reload()
        return null
      },
      signUp: async (name, email, password) => {
        const message = await authPost("sign-up/email", { name, email, password })
        if (message) return message
        await reload()
        return null
      },
    }),
    [status, session, error, reload, logout]
  )

  const family = session?.family ?? null
  const viewerId = session?.viewer.id ?? ""

  const updateProfile = React.useCallback(
    async (patch: { name?: string; avatar?: CharacterConfig }) => {
      if (patch.name !== undefined && validateMemberName(patch.name)) return false
      try {
        await api("me/profile", "PUT", { ...patch, requestId: crypto.randomUUID() })
        await reload()
        setLastError(null)
        return true
      } catch (e) {
        setLastError(errorMessage(e))
        return false
      }
    },
    [reload]
  )

  const onboarding = React.useMemo<OnboardingContextValue>(
    () => ({
      mode: "live",
      currentFamily: family,
      supportsLookup: false,
      inviteAdapter: noLookup,
      demoCodes: [],
      logout,
      lastError,
      createFamily: async (name, member) => {
        if (validateFamilyName(name) || validateMemberName(member.name)) return null
        try {
          const s = await api<LiveSession>("families", "POST", { name: name.trim(), requestId: crypto.randomUUID() })
          await api("me/profile", "PUT", { name: member.name.trim(), avatar: member.avatar, requestId: crypto.randomUUID() })
          await reload()
          setLastError(null)
          return s.family ? { familyId: s.family.id, memberId: s.viewer.id } : null
        } catch (e) {
          setLastError(errorMessage(e))
          // 가족은 만들어졌지만 프로필 저장만 실패했을 수 있다. 세션을 다시 읽어 화면이 실제 상태를 따르게 한다.
          await reload()
          return null
        }
      },
      joinFamily: async (inviteCode, member) => {
        if (validateMemberName(member.name)) return null
        try {
          const s = await api<LiveSession>("family/join", "POST", { inviteCode: inviteCode.trim(), requestId: crypto.randomUUID() })
          await api("me/profile", "PUT", { name: member.name.trim(), avatar: member.avatar, requestId: crypto.randomUUID() })
          await reload()
          setLastError(null)
          return s.family ? { familyId: s.family.id, memberId: s.viewer.id } : null
        } catch (e) {
          setLastError(errorMessage(e))
          await reload()
          return null
        }
      },
    }),
    [family, logout, lastError, reload]
  )

  const familyValue = React.useMemo<FamilyContextValue | null>(() => {
    if (!family) return null
    const viewer: FamilyMember = family.members.find((m) => m.id === viewerId) ?? family.members[0]
    return {
      mode: "live",
      family,
      viewer,
      viewerId,
      isAdmin: isFamilyAdmin(family, viewerId),
      families: [family],
      lastError,
      logout,
      setViewerId: () => {},
      switchFamily: () => false,
      updateMyProfile: updateProfile,
      setTheme: async (theme) => {
        try {
          await api("family/settings", "PUT", { theme, requestId: crypto.randomUUID() })
          await reload()
          setLastError(null)
          return true
        } catch (e) {
          setLastError(errorMessage(e))
          return false
        }
      },
      renameFamily: async (name) => {
        if (validateFamilyName(name)) return false
        try {
          await api("family/settings", "PUT", { name: name.trim(), requestId: crypto.randomUUID() })
          await reload()
          setLastError(null)
          return true
        } catch (e) {
          setLastError(errorMessage(e))
          return false
        }
      },
      createInvite: async () => {
        try {
          const r = await api<{ inviteCode: string; expiresAt?: string }>("family/invites", "POST", { requestId: crypto.randomUUID() })
          setLastError(null)
          return { inviteCode: r.inviteCode, expiresAt: r.expiresAt ?? null }
        } catch (e) {
          setLastError(errorMessage(e))
          return null
        }
      },
      spotOf: (memberId) => {
        const saved = spots[memberId]
        if (saved) return saved
        const index = family.members.findIndex((m) => m.id === memberId)
        return defaultSpot(Math.max(0, index), family.members.length)
      },
      moveMember: (memberId, spot) => setSpots((s) => ({ ...s, [memberId]: clampSpot(spot) })),
    }
  }, [family, viewerId, lastError, logout, updateProfile, reload, spots])

  return (
    <SessionContext.Provider value={sessionValue}>
      <OnboardingContext.Provider value={onboarding}>
        {familyValue ? <FamilyContext.Provider value={familyValue}>{children}</FamilyContext.Provider> : children}
      </OnboardingContext.Provider>
    </SessionContext.Provider>
  )
}

/** 라이브 세션 상태. 데모 모드에서는 null이다. */
export function useSession() {
  return React.useContext(SessionContext)
}
