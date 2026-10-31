import { AlertCircle, CircleCheck, Loader2, PenLine, Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/**
 * AI 제안 상태 표시. 라이브에서는 idle/loading/success/error를 쓰고, 데모에서는 "demo"(직접 다듬기)만 쓴다.
 * 데모일 때 완료·분석 같은 표현을 쓰지 않고, 성공 상태에서도 '확인·수정'을 요구한다.
 */
export type AdapterPhase = "demo" | "idle" | "loading" | "success" | "error"

const PHASES: Record<AdapterPhase, { icon: typeof Sparkles; label: string; description: string; tone?: string }> = {
  demo: {
    icon: PenLine,
    label: "AI 연결 전 직접 다듬기 · 데모",
    description: "실제 AI가 연결되면 여기서 제안 문장을 받아요. 지금은 원문을 보고 직접 써요.",
  },
  idle: { icon: Sparkles, label: "AI 제안 대기", description: "'AI 제안 받기'를 누를 때만 원문을 서버로 보내 문장을 제안해요. 보관하지 않아요." },
  loading: { icon: Loader2, label: "문장을 제안하는 중", description: "잠시만 기다려 주세요. 원문을 고치면 이 제안은 버려져요." },
  success: { icon: CircleCheck, label: "제안을 받았어요", description: "AI 제안은 출발점이에요. 사실과 다른 내용이 없는지 확인하고 직접 고쳐 주세요." },
  error: {
    icon: AlertCircle,
    label: "제안을 받지 못했어요",
    description: "직접 쓰거나 잠시 후 다시 시도해 주세요.",
    tone: "text-destructive",
  },
}

export function AdapterStatus({ phase, label, errorMessage, className }: { phase: AdapterPhase; label?: string; errorMessage?: string; className?: string }) {
  const p = PHASES[phase]
  const Icon = p.icon
  return (
    <div
      role="status"
      className={cn("flex items-start gap-3 rounded-xl bg-secondary px-4 py-3", className)}
      aria-busy={phase === "loading"}
    >
      <Icon
        className={cn("mt-0.5 size-4 shrink-0 text-primary", phase === "loading" && "motion-safe:animate-spin", p.tone)}
        aria-hidden="true"
      />
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn("text-sm font-semibold", p.tone)}>{phase === "success" && label ? label : p.label}</p>
          {phase === "demo" && (
            <Badge variant="outline" className="h-5 px-2 text-muted-foreground">
              데모
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{phase === "error" && errorMessage ? errorMessage : p.description}</p>
      </div>
    </div>
  )
}
