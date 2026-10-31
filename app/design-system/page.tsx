import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { AlertCircle, CalendarDays, CalendarPlus, Heart, House, Images, Trash2 } from "lucide-react"

import { Logo } from "@/components/logo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { BottomNav, type BottomNavItem } from "@/components/woorijip/bottom-nav"
import { MemberChip, MemberProfile, type Member } from "@/components/woorijip/member"
import { PhotoCard } from "@/components/woorijip/photo-card"
import { PrivateNoteCard } from "@/components/woorijip/private-note-card"
import { ScheduleCard, ScheduleCardSkeleton } from "@/components/woorijip/schedule-card"
import { EmptyState } from "@/components/woorijip/state-views"
import { formatFullDate } from "@/lib/format"

import { LoadingButtonDemo, RetryDemo, SheetDemo } from "./demos"

export const metadata: Metadata = {
  title: "디자인 확인",
  robots: { index: false, follow: false },
}

// ── 가상 데이터(디자인 검증 전용) ─────────────────────────────
const MEMBERS: Member[] = [
  { id: "mom", name: "엄마", role: "가족방 관리자", tone: "apricot" },
  { id: "dad", name: "아빠", role: "구성원", tone: "sky" },
  { id: "jiwoo", name: "지우", role: "구성원", tone: "butter" },
  { id: "grandma", name: "외할머니 김순자", role: "구성원 · 이름이 긴 경우", tone: "sage" },
  { id: "minho", name: "민호", tone: "sky" },
]
const DINNER_AT = "2026-10-31T19:00:00+09:00"
const PHOTO_AT = "2026-10-25T14:30:00+09:00"

const NAV_ITEMS: BottomNavItem[] = [
  { key: "home", label: "우리집", href: "/design-system?tab=home", icon: House },
  { key: "calendar", label: "일정", href: "/design-system?tab=calendar", icon: CalendarDays },
  { key: "memories", label: "추억", href: "/design-system?tab=memories", icon: Images },
  { key: "heart", label: "마음", href: "/design-system?tab=heart", icon: Heart },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
      {children}
    </section>
  )
}

export default async function DesignSystemPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  // 개발 환경 전용. 프로덕션 빌드·배포에서는 404.
  if (process.env.NODE_ENV === "production") notFound()

  const { tab } = await searchParams
  const activeTab = NAV_ITEMS.some((i) => i.key === tab) ? tab! : "home"
  const [mom, dad, jiwoo, grandma] = MEMBERS

  return (
    <div className="min-h-dvh pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+--spacing(8))]">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
          <Logo withWordmark />
          <Badge variant="outline" className="h-6 px-2.5">
            디자인 확인용
          </Badge>
        </div>
      </header>

      <main className="mx-auto flex max-w-md flex-col gap-10 px-4 pt-6">
        <div role="note" className="flex gap-3 rounded-xl bg-secondary p-4 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p>
            이 화면은 <strong className="font-semibold">가상 데이터</strong>로 디자인만 확인하는 개발용 페이지예요.
            로그인, 비공개 저장, 전달 기능은 아직 구현되지 않았어요.
          </p>
        </div>

        <Section title="타이포그래피">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground tabular-nums">
              <time dateTime={DINNER_AT}>{formatFullDate(new Date(DINNER_AT))}</time>
            </p>
            <h1 className="font-display text-3xl leading-tight font-bold tracking-tight">우리 가족의 오늘</h1>
            <p>
              오늘 저녁 7시, 함께 식사해요. 지우는 학원 끝나고 6시 40분쯤 도착해요. 본문은 16px, 행간 1.625로
              읽기 편하게 맞췄어요.
            </p>
            <p className="text-sm text-muted-foreground">보조 문구 · 14px · Pretendard</p>
          </div>
          <div className="flex flex-col gap-1 rounded-xl bg-card p-4 ring-1 ring-border">
            <p className="font-display text-2xl font-semibold tracking-tight">Woorijip 2026 · 우리집</p>
            <p className="text-sm text-muted-foreground">
              영문·숫자는 Cal Sans, 한글은 Pretendard로 자연스럽게 넘어가요.
            </p>
            <p className="font-mono text-sm text-muted-foreground">mono · 2026-10-31 19:00</p>
          </div>
          <p className="rounded-xl bg-card p-4 ring-1 ring-border">
            긴한국어문장줄바꿈확인: 가족구성원모두가함께참여하는주말대청소일정은토요일오전열시부터시작해요.
            https://example.com/very/long/link/that/should/wrap/inside/the/card
          </p>
        </Section>

        <Separator />

        <Section title="버튼">
          <div className="grid grid-cols-2 gap-3">
            <Button>기본</Button>
            <Button variant="secondary">보조</Button>
            <Button variant="outline">외곽선</Button>
            <Button variant="destructive">
              <Trash2 aria-hidden="true" />
              삭제
            </Button>
            <Button disabled>비활성</Button>
            <Button variant="ghost">고스트</Button>
          </div>
          <LoadingButtonDemo />
          <Button size="lg" className="w-full">
            <CalendarPlus aria-hidden="true" />
            일정 추가하기
          </Button>
        </Section>

        <Separator />

        <Section title="입력">
          <div className="flex flex-col gap-2">
            <label htmlFor="ds-title" className="text-sm font-medium">
              일정 이름
            </label>
            <Input id="ds-title" placeholder="예: 주말 가족 나들이" />
            <p className="text-sm text-muted-foreground">눌러서 포커스 상태를 확인하세요.</p>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="ds-time" className="text-sm font-medium">
              시작 시간
            </label>
            <Input
              id="ds-time"
              defaultValue="25:00"
              aria-invalid="true"
              aria-describedby="ds-time-error"
              inputMode="numeric"
            />
            <p id="ds-time-error" className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              시간은 00:00부터 23:59 사이로 입력해 주세요.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="ds-disabled" className="text-sm font-medium text-muted-foreground">
              비활성 입력
            </label>
            <Input id="ds-disabled" disabled defaultValue="수정할 수 없어요" />
          </div>
        </Section>

        <Separator />

        <Section title="가족 구성원">
          <div className="flex flex-wrap gap-2">
            {MEMBERS.map((m) => (
              <MemberChip key={m.id} member={m} />
            ))}
          </div>
          <div className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-border">
            <MemberProfile member={mom} />
            <MemberProfile member={grandma} />
          </div>
        </Section>

        <Separator />

        <Section title="카드">
          <ScheduleCard
            title="오늘 저녁 7시, 함께 식사해요"
            startsAt={new Date(DINNER_AT)}
            place="우리집 거실"
            members={MEMBERS}
            action={
              <Button variant="secondary">참여</Button>
            }
          />
          <PhotoCard
            caption="가을 소풍에서 다 같이 찍은 사진. 캡션이 길어지면 두 줄에서 말줄임표로 줄여요."
            takenAt={new Date(PHOTO_AT)}
            uploader={dad}
          />
          <PrivateNoteCard
            recipientName={jiwoo.name}
            original="요즘 대화가 줄어서 서운했어. 내가 너무 잔소리만 한 것 같기도 하고."
            outgoing="지우야, 요즘 바빠 보여서 걱정됐어. 주말에 같이 산책할래?"
            actions={
              <>
                <Button variant="outline">다시 다듬기</Button>
                <Button>확인하고 보내기</Button>
              </>
            }
          />
        </Section>

        <Separator />

        <Section title="빈 상태 · 로딩 · 오류">
          <EmptyState
            icon={CalendarDays}
            title="아직 등록된 일정이 없어요"
            description="가족과 함께할 첫 일정을 추가해 보세요."
            action={
              <Button>
                <CalendarPlus aria-hidden="true" />
                일정 추가
              </Button>
            }
          />
          <div aria-hidden="true" className="flex flex-col gap-3">
            <ScheduleCardSkeleton />
            <div className="flex items-center gap-3">
              <Skeleton className="size-11 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          </div>
          <RetryDemo members={MEMBERS.slice(0, 3)} startsAt={DINNER_AT} />
        </Section>

        <Separator />

        <Section title="바텀시트">
          <SheetDemo members={[mom, dad, jiwoo]} startsAt={DINNER_AT} />
          <p className="text-sm text-muted-foreground">
            닫기·바깥 탭·ESC로 닫으면 포커스가 버튼으로 돌아와요. 긴 입력은 추후 전체 화면으로 만들어요.
          </p>
        </Section>

        <Separator />

        <Section title="하단 내비게이션">
          <p className="text-sm text-muted-foreground">
            화면 아래에 고정된 4탭을 눌러 활성 상태를 확인하세요. 현재: {NAV_ITEMS.find((i) => i.key === activeTab)?.label}
          </p>
        </Section>
      </main>

      <BottomNav items={NAV_ITEMS} activeKey={activeTab} />
    </div>
  )
}
