"use client"

import * as React from "react"
import { Check, CheckCircle2, ChevronRight, House, Inbox, PencilLine, Share2, UserRound, UsersRound } from "lucide-react"
import Link from "next/link"

import { DemoViewerSwitch } from "@/components/demo/demo-viewer-switch"
import { useFamily } from "@/components/family/family-provider"
import { InviteSheet } from "@/components/family/invite-sheet"
import { RenameFamilyDialog } from "@/components/family/rename-dialog"
import { FamilyAvatar } from "@/components/home/family-avatar"
import { HomeDetailSheet } from "@/components/home/home-detail-sheet"
import { useReturnFocus } from "@/components/mind/use-return-focus"
import { Button } from "@/components/ui/button"
import { AppShell } from "@/components/woorijip/app-shell"
import { MenuGroup, MenuRow } from "@/components/woorijip/list-row"
import { canInvite, canRenameFamily } from "@/lib/family/permissions"
import { memberRoleLabel } from "@/lib/family/types"
import { themeInfo } from "@/lib/scene/themes"

/** 더보기: 나(프로필·캐릭터, 수신함) / 가족(구성원, 집안일, 테마, 초대, 이름) / 데모 컨트롤. 관리자 전용 항목은 권한 함수로 숨긴다. */
export function MoreScreen() {
  const { family, viewer, viewerId, families, renameFamily, switchFamily } = useFamily()
  const [membersOpen, setMembersOpen] = React.useState(false)
  const [inviteOpen, setInviteOpen] = React.useState(false)
  const [renameOpen, setRenameOpen] = React.useState(false)
  const membersFocus = React.useRef<HTMLElement | null>(null)
  const inviteFocus = useReturnFocus()
  const renameFocus = useReturnFocus()
  const admin = canInvite(family, viewerId)

  return (
    <AppShell title="더보기" flush mainClassName="gap-0">
      <Link
        href="/me/character"
        className="flex min-h-24 items-center gap-3.5 bg-card px-5 py-5 outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset active:bg-muted"
      >
        <FamilyAvatar member={viewer} size={56} decorative />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-lg font-bold">{viewer.name}</span>
          <span className="text-sm text-muted-foreground">{memberRoleLabel(family, viewer)} · 데모 계정</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>

      <div className="flex flex-col gap-6 px-4 pt-6">
        <MenuGroup label="나">
          <MenuRow icon={UserRound} title="내 프로필 · 캐릭터" subtitle="이름과 캐릭터를 변경해요" href="/me/character" />
          <MenuRow icon={Inbox} title="마음 수신함" subtitle="받은 마음과 보낸 마음" href="/inbox" />
        </MenuGroup>

        <MenuGroup label="가족">
          <MenuRow
            icon={UsersRound}
            title="가족 구성원"
            subtitle={`${family.members.length}명이 함께하고 있어요`}
            onClick={(e) => {
              membersFocus.current = e.currentTarget
              setMembersOpen(true)
            }}
          />
          <MenuRow icon={CheckCircle2} title="집안일" subtitle="지정된 할 일을 확인해요" href="/chores" />
          <MenuRow
            icon={House}
            title="우리집 테마"
            subtitle={`${themeInfo(family.theme).name}${admin ? "" : " · 보기만 가능"}`}
            href="/family/theme"
          />
          {canRenameFamily(family, viewerId) && (
            <MenuRow
              icon={PencilLine}
              title="가족 이름"
              subtitle={family.name}
              onClick={(e) => {
                renameFocus.capture(e.currentTarget)
                setRenameOpen(true)
              }}
            />
          )}
          {admin && (
            <MenuRow
              icon={Share2}
              title="가족 초대"
              subtitle="코드와 링크로 초대해요"
              onClick={(e) => {
                inviteFocus.capture(e.currentTarget)
                setInviteOpen(true)
              }}
            />
          )}
        </MenuGroup>

        <section aria-label="프로토타입 제어" className="flex flex-col gap-3 border-l-3 border-primary bg-muted px-4 py-4">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-bold tracking-wide text-primary">프로토타입 제어</p>
            <p className="font-semibold">권한 화면 비교</p>
            <p className="text-sm text-muted-foreground">실제 계정 전환이 아닌 화면 확인용 데모예요. 관리자 권한은 구성원에 묶여 있어요.</p>
          </div>
          <DemoViewerSwitch className="bg-card" />
          {families.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold text-muted-foreground">이 탭에서 만든·참여한 가족 (전환하면 그 가족의 데이터만 보여요)</p>
              <ul role="radiogroup" aria-label="데모 가족 전환" className="flex flex-col gap-1">
                {families.map((f) => {
                  const selected = f.id === family.id
                  return (
                    <li key={f.id}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => switchFamily(f.id)}
                        className="flex min-h-11 w-full items-center gap-2 rounded-md bg-card px-3 text-left text-sm outline-none ring-1 ring-border hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-secondary aria-checked:ring-2 aria-checked:ring-primary"
                      >
                        <span className="min-w-0 flex-1 truncate font-medium">{f.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {f.members.length}명{f.seed ? " · 예시" : ""}
                        </span>
                        {selected && <Check className="size-4 text-primary" aria-hidden="true" />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          <Button variant="outline" className="justify-between" asChild>
            <Link href="/welcome">
              온보딩 데모 처음부터 보기
              <ChevronRight aria-hidden="true" />
            </Link>
          </Button>
        </section>
      </div>

      <HomeDetailSheet selection={{ type: "family" }} open={membersOpen} onOpenChange={setMembersOpen} returnFocusRef={membersFocus} />
      <InviteSheet
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onCloseAutoFocus={inviteFocus.onCloseAutoFocus}
        familyName={family.name}
        code={family.inviteCode}
      />
      <RenameFamilyDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        onCloseAutoFocus={renameFocus.onCloseAutoFocus}
        current={family.name}
        onSave={renameFamily}
      />
    </AppShell>
  )
}
