"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Check, LockKeyhole } from "lucide-react"

import { DemoViewerSwitch } from "@/components/demo/demo-viewer-switch"
import { useFamily } from "@/components/family/family-provider"
import { Button } from "@/components/ui/button"
import { FlowPage, PrivacyNote, StepLabel } from "@/components/woorijip/flow-page"
import { canChangeTheme } from "@/lib/family/permissions"
import { SCENE_THEMES, themeLayerSrc, type SceneTheme } from "@/lib/scene/themes"
import { cn } from "@/lib/utils"

/**
 * 가족 공통 테마(전체 화면). 관리자는 초안을 골라 미리 본 뒤 '가족에게 적용'하고, 취소하면 원래 테마가 유지된다.
 * 일반 구성원은 보기만 가능하다. 테마는 캐릭터·일정·사진·집안일·메시지에 영향을 주지 않는다.
 */
export function ThemeScreen() {
  const router = useRouter()
  const { family, viewerId, setTheme } = useFamily()
  const allowed = canChangeTheme(family, viewerId)
  const [draft, setDraft] = React.useState<SceneTheme>(family.theme)
  const [notice, setNotice] = React.useState<string | null>(null)
  // 데모 인물이 바뀌거나 다른 곳에서 테마가 바뀌면 초안을 현재 값으로 되돌린다.
  const [base, setBase] = React.useState(family.theme)
  if (base !== family.theme) {
    setBase(family.theme)
    setDraft(family.theme)
  }
  const dirty = allowed && draft !== family.theme

  function apply() {
    const ok = setTheme(draft)
    if (!ok) {
      setNotice("가족 관리자만 테마를 바꿀 수 있어요.")
      return
    }
    router.push("/home")
  }

  return (
    <FlowPage
      title="우리집 테마"
      eyebrow={`가족 공통 설정 · ${SCENE_THEMES.length}가지 공간`}
      back="/more"
      action={
        allowed ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="lg" onClick={() => router.push("/more")}>
              취소
            </Button>
            <Button size="lg" onClick={apply} disabled={!dirty}>
              가족에게 적용
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="lg" onClick={() => router.push("/more")}>
            돌아가기
          </Button>
        )
      }
    >
      <DemoViewerSwitch />
      <p className="text-sm text-muted-foreground">
        건물 구조와 풍경이 다른 공간을 미리 보세요. 테마를 바꿔도 캐릭터와 가족 데이터는 그대로 유지돼요.
      </p>
      {notice && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {notice}
        </p>
      )}
      {!allowed && (
        <PrivacyNote icon={LockKeyhole} title="관리자만 변경할 수 있어요">
          현재 테마는 볼 수 있지만 변경 권한은 가족 관리자에게 있어요. 이 권한 동작은 프론트 데모 규칙이에요.
        </PrivacyNote>
      )}

      <div className="-mx-4 overflow-hidden bg-home-scene" style={{ aspectRatio: "13 / 9" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- 정적 픽셀 SVG */}
        <img
          src={themeLayerSrc(draft, "background")}
          alt={`${SCENE_THEMES.find((t) => t.id === draft)?.name} 미리보기`}
          className="pixelated block h-full w-full object-cover object-bottom"
        />
      </div>

      <div className="flex flex-col gap-1">
        <StepLabel>{allowed ? (dirty ? "적용 전 미리보기" : "현재 테마") : "현재 가족 테마"}</StepLabel>
        <ul role="radiogroup" aria-label="테마" className="flex flex-col divide-y divide-border border-t border-border">
          {SCENE_THEMES.map((t) => {
            const selected = draft === t.id
            const current = family.theme === t.id
            return (
              <li key={t.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-disabled={!allowed || undefined}
                  onClick={() => allowed && setDraft(t.id)}
                  className={cn(
                    "flex min-h-24 w-full items-center gap-3 rounded-md px-1 py-2.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
                    allowed ? "hover:bg-muted/60 active:bg-muted" : "cursor-default",
                    selected && allowed && "bg-secondary/60"
                  )}
                >
                  <span className={cn("block h-17 w-24 shrink-0 overflow-hidden rounded-md bg-home-scene ring-1 ring-border", selected && "ring-2 ring-primary")}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- 정적 픽셀 SVG 썸네일 */}
                    <img src={themeLayerSrc(t.id, "background")} alt="" className="pixelated block h-full w-full object-cover" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-semibold">
                      {t.name}
                      {current && <span className="ml-1.5 text-xs font-semibold text-primary">현재</span>}
                    </span>
                    <span className="text-sm text-muted-foreground">{t.description}</span>
                  </span>
                  {selected && <Check className="size-5 shrink-0 text-primary" aria-hidden="true" />}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </FlowPage>
  )
}
