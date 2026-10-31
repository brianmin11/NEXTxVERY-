import { cn } from "@/lib/utils"

export type MemberTone = "apricot" | "sky" | "butter" | "sage"

export type Member = {
  id: string
  name: string
  role?: string
  tone: MemberTone
}

// 장식 팔레트는 아바타 배경에만 쓰고 글자는 항상 foreground로 둔다(대비 7:1 이상).
const toneClass: Record<MemberTone, string> = {
  apricot: "bg-deco-apricot",
  sky: "bg-deco-sky",
  butter: "bg-deco-butter",
  sage: "bg-secondary",
}

const avatarSize = {
  sm: "size-6 text-xs",
  md: "size-8 text-sm",
  lg: "size-11 text-base",
} as const

type MemberAvatarProps = {
  member: Member
  size?: keyof typeof avatarSize
  className?: string
}

/** 이름 첫 글자를 보여주는 원형 프로필. 이름은 항상 함께 제공(시각적으로 숨겨도 읽힘). */
export function MemberAvatar({ member, size = "md", className }: MemberAvatarProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-foreground ring-2 ring-card",
        toneClass[member.tone],
        avatarSize[size],
        className
      )}
    >
      <span aria-hidden="true">{Array.from(member.name)[0]}</span>
      <span className="sr-only">{member.name}</span>
    </span>
  )
}

/** 겹쳐 보이는 참여자 묶음. max를 넘으면 +N으로 줄인다. */
export function MemberStack({ members, max = 4 }: { members: Member[]; max?: number }) {
  const shown = members.slice(0, max)
  const rest = members.length - shown.length
  return (
    <span className="flex items-center -space-x-1.5">
      {shown.map((m) => (
        <MemberAvatar key={m.id} member={m} size="sm" />
      ))}
      {rest > 0 && (
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground ring-2 ring-card">
          +{rest}
          <span className="sr-only">명 더</span>
        </span>
      )}
    </span>
  )
}

/** 표시용 구성원 칩. 선택 가능한 칩이 필요하면 Button(variant="outline")으로 감싼다. */
export function MemberChip({ member, className }: { member: Member; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full min-w-0 items-center gap-2 rounded-full border border-border bg-card py-1 pr-3 pl-1 text-sm font-medium",
        className
      )}
    >
      <MemberAvatar member={member} size="sm" />
      <span className="truncate" aria-hidden="true">
        {member.name}
      </span>
    </span>
  )
}

/** 작은 프로필 표시: 아바타 + 이름 + 역할 */
export function MemberProfile({ member }: { member: Member }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <MemberAvatar member={member} size="lg" />
      <div className="min-w-0">
        <p className="truncate font-semibold" aria-hidden="true">
          {member.name}
        </p>
        {member.role && <p className="truncate text-sm text-muted-foreground">{member.role}</p>}
      </div>
    </div>
  )
}
