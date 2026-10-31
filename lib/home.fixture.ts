// 프론트 데모용 가상 가족 데이터. 실제 저장·API와 연결되지 않는다.
import type { MemberTone } from "@/components/woorijip/member"

export type AvatarFace = "smile" | "calm" | "wink"
export type AvatarAccessory = "none" | "glasses" | "ribbon" | "cap" | "flower"

/** 캐릭터 외형 설정. 역할·성별과 무관하게 자유롭게 조합한다. */
export type AvatarConfig = {
  face: AvatarFace
  accessory: AvatarAccessory
}

export type FamilyMember = {
  id: string
  name: string
  role?: string
  tone: MemberTone
  avatar: AvatarConfig
}

/** 집 시각 상태 ID. 산정 정책은 미정이며, 지금은 미리보기 시안에만 쓴다. */
export type HouseStage = 1 | 2 | 3 | 4 | 5

export type Family = {
  id: string
  name: string
  members: FamilyMember[]
  houseStage: HouseStage
}

// 일정은 lib/calendar/fixture.ts(seedEvents)가 원본이다. 홈과 캘린더가 같은 상태를 읽는다.


// 추억 사진은 lib/memories/fixture.ts(seedMemories)가 원본이다. 홈과 /memories가 같은 상태를 읽는다.

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

const MOM: FamilyMember = {
  id: "mom",
  name: "엄마",
  role: "가족방 관리자",
  tone: "apricot",
  avatar: { face: "smile", accessory: "flower" },
}
const DAD: FamilyMember = {
  id: "dad",
  name: "아빠",
  role: "구성원",
  tone: "sky",
  avatar: { face: "calm", accessory: "glasses" },
}
const JIWOO: FamilyMember = {
  id: "jiwoo",
  name: "지우",
  role: "구성원",
  tone: "butter",
  avatar: { face: "wink", accessory: "cap" },
}
const HAJUN: FamilyMember = {
  id: "hajun",
  name: "하준",
  role: "구성원",
  tone: "sage",
  avatar: { face: "smile", accessory: "none" },
}

/** 4명: 기본 데모 */
export const DEMO_FAMILY_FOUR: Family = {
  id: "fam-four",
  name: "다정한 우리집",
  houseStage: 3,
  members: [MOM, DAD, JIWOO, HAJUN],
}

/** 1명: 혼자 시작한 경우 */
export const DEMO_FAMILY_ONE: Family = {
  id: "fam-one",
  name: "나의 작은 집",
  houseStage: 1,
  members: [{ ...JIWOO, id: "solo", name: "지우", role: "가족방 관리자" }],
}

/** 8명: 긴 이름·겹침·+N 확인 */
export const DEMO_FAMILY_EIGHT: Family = {
  id: "fam-eight",
  name: "북적북적 큰집",
  houseStage: 5,
  members: [
    MOM,
    DAD,
    JIWOO,
    HAJUN,
    { id: "grandma", name: "외할머니 김순자", role: "구성원", tone: "butter", avatar: { face: "smile", accessory: "ribbon" } },
    { id: "grandpa", name: "외할아버지", role: "구성원", tone: "sage", avatar: { face: "calm", accessory: "glasses" } },
    { id: "aunt", name: "고모 박은영", role: "구성원", tone: "sky", avatar: { face: "wink", accessory: "none" } },
    {
      id: "cousin",
      name: "사촌 크리스토퍼 알렉산더",
      role: "구성원 · 이름이 아주 긴 경우",
      tone: "apricot",
      avatar: { face: "smile", accessory: "cap" },
    },
  ],
}

function homeFor(family: Family): HomeData {
  const ids = family.members.map((m) => m.id)
  const first = ids[0]
  return {
    family,
    viewerId: first,
    notifications:
      family.members.length > 1
        ? [
            { id: "n1", text: `${family.members[1].name}님이 '함께 저녁 먹기' 일정에 참여했어요`, at: "2026-10-31T09:10:00+09:00" },
            { id: "n2", text: "오늘 내 할 일 2개 중 1개를 끝냈어요", at: "2026-10-31T08:00:00+09:00" },
          ]
        : [],
  }
}

export const DEMO_HOME_ONE = homeFor(DEMO_FAMILY_ONE)
export const DEMO_HOME_FOUR = homeFor(DEMO_FAMILY_FOUR)
export const DEMO_HOME_EIGHT = homeFor(DEMO_FAMILY_EIGHT)

/** /home 기본 데이터 */
export const DEMO_HOME = DEMO_HOME_FOUR

export function findMember(family: Family, id: string) {
  return family.members.find((m) => m.id === id)
}
