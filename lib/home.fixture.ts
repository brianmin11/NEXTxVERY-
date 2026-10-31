// 프론트 데모용 가상 가족 데이터. 실제 저장·API와 연결되지 않는다.
// 타입의 원본은 lib/family/types.ts다. 기존 import 경로를 위해 여기서 다시 내보낸다.
import type { CharacterConfig } from "@/lib/character/catalog"
import type { Family, FamilyMember } from "@/lib/family/types"

export type { Family, FamilyMember } from "@/lib/family/types"
export { findMember, isFamilyAdmin, memberRoleLabel } from "@/lib/family/types"

// 일정은 lib/calendar/fixture.ts(seedEvents)가, 추억은 lib/memories/fixture.ts(seedMemories)가,
// 집안일은 lib/chores/fixture.ts(seedChores)가 원본이다. 홈과 각 화면이 같은 provider 상태를 읽는다.

export type NotificationItem = {
  id: string
  text: string
  at: string
}

export type HomeData = {
  family: Family
  /** 현재 보고 있는 구성원(가상) */
  viewerId: string
  notifications: NotificationItem[]
}

const AVATARS = {
  mom: { skin: "skin2", hair: "bob_brown", outfit: "cardigan", accessory: "ribbon" },
  dad: { skin: "skin4", hair: "sidepart_darkbrown", outfit: "hoodie", accessory: "glasses" },
  jiwoo: { skin: "skin3", hair: "bun_black", outfit: "overalls", accessory: "cap" },
  hajun: { skin: "skin5", hair: "short_black", outfit: "sweater", accessory: "none" },
  grandma: { skin: "skin1", hair: "bangs_chestnut", outfit: "dress", accessory: "none" },
  grandpa: { skin: "skin4", hair: "short_black", outfit: "shirt", accessory: "glasses" },
  aunt: { skin: "skin3", hair: "long_black", outfit: "jacket", accessory: "headphones" },
  cousin: { skin: "skin2", hair: "curly_darkbrown", outfit: "stripes", accessory: "beanie" },
} satisfies Record<string, CharacterConfig>

// 역할(엄마·아빠)은 호칭일 뿐이고 관리자 권한은 adminMemberId로만 정한다.
const MOM: FamilyMember = { id: "mom", name: "엄마", role: "엄마", tone: "apricot", avatar: AVATARS.mom }
const DAD: FamilyMember = { id: "dad", name: "아빠", role: "아빠", tone: "sky", avatar: AVATARS.dad }
const JIWOO: FamilyMember = { id: "jiwoo", name: "지우", role: "첫째", tone: "butter", avatar: AVATARS.jiwoo }
const HAJUN: FamilyMember = { id: "hajun", name: "하준", role: "둘째", tone: "sage", avatar: AVATARS.hajun }

/** 4명: 기본 데모. 가족을 만든 아빠가 관리자다(엄마 역할과 관리자 권한은 별개). */
export const DEMO_FAMILY_FOUR: Family = {
  id: "fam-four",
  name: "다정한 우리집",
  members: [MOM, DAD, JIWOO, HAJUN],
  adminMemberId: "dad",
  theme: "sunny-garden",
  inviteCode: "WOORI24",
  seed: true,
}

/** 1명: 혼자 시작한 경우 */
export const DEMO_FAMILY_ONE: Family = {
  id: "fam-one",
  name: "나의 작은 집",
  members: [{ ...JIWOO, id: "solo", name: "지우", role: undefined }],
  adminMemberId: "solo",
  theme: "forest-cabin",
  inviteCode: "SOLO01",
  seed: true,
}

/** 8명: 긴 이름·겹침·+N 확인 */
export const DEMO_FAMILY_EIGHT: Family = {
  id: "fam-eight",
  name: "북적북적 큰집",
  members: [
    MOM,
    DAD,
    JIWOO,
    HAJUN,
    { id: "grandma", name: "외할머니 김순자", role: "외할머니", tone: "butter", avatar: AVATARS.grandma },
    { id: "grandpa", name: "외할아버지", role: "외할아버지", tone: "sage", avatar: AVATARS.grandpa },
    { id: "aunt", name: "고모 박은영", role: "고모", tone: "sky", avatar: AVATARS.aunt },
    { id: "cousin", name: "사촌 크리스토퍼", role: "사촌 · 이름이 긴 경우", tone: "apricot", avatar: AVATARS.cousin },
  ],
  adminMemberId: "mom",
  theme: "blossom-hill",
  inviteCode: "BIGH08",
  seed: true,
}

function homeFor(family: Family, viewerId: string): HomeData {
  return {
    family,
    viewerId,
    notifications:
      family.members.length > 1
        ? [
            { id: "n1", text: `${family.members[0].name}님이 '함께 저녁 먹기' 일정에 참여했어요`, at: "2026-10-31T09:10:00+09:00" },
            { id: "n2", text: "오늘 내 할 일 2개 중 1개를 끝냈어요", at: "2026-10-31T08:00:00+09:00" },
          ]
        : [],
  }
}

export const DEMO_HOME_ONE = homeFor(DEMO_FAMILY_ONE, "solo")
export const DEMO_HOME_FOUR = homeFor(DEMO_FAMILY_FOUR, "dad")
export const DEMO_HOME_EIGHT = homeFor(DEMO_FAMILY_EIGHT, "mom")

/** /home 기본 데이터. 기본 인물은 관리자(아빠)라 관리자 전용 메뉴를 바로 볼 수 있다. */
export const DEMO_HOME = DEMO_HOME_FOUR
