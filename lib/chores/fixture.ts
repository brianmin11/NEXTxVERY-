import { addDays } from "@/lib/calendar/date"
import type { DateKey } from "@/lib/calendar/types"

import type { Chore } from "./types"

/** 가상 집안일 seed. 오늘 기준으로 만들어 날짜 표시(오늘·기한 지남·미정)를 모두 볼 수 있게 한다. 한 번만 만든다. */
export function seedChores(today: DateKey, memberIds: string[]): Chore[] {
  const [mom, dad, jiwoo, hajun] = memberIds
  const yesterday = addDays(today, -1)
  const base = (date: DateKey, time: string) => `${date}T${time}:00+09:00`
  return [
    {
      id: "seed-dishes",
      title: "설거지",
      memo: "저녁 먹고 나서 바로",
      assigneeMemberId: mom,
      dueDate: today,
      status: "todo",
      createdByMemberId: dad ?? mom,
      createdAt: base(yesterday, "20:00"),
      updatedAt: base(yesterday, "20:00"),
      completedAt: null,
      completedByMemberId: null,
      seed: true,
    },
    {
      id: "seed-laundry",
      title: "빨래 개기",
      memo: "",
      assigneeMemberId: mom,
      dueDate: yesterday,
      status: "done",
      createdByMemberId: mom,
      createdAt: base(addDays(today, -2), "09:00"),
      updatedAt: base(yesterday, "21:00"),
      completedAt: base(yesterday, "21:00"),
      completedByMemberId: mom,
      seed: true,
    },
    {
      id: "seed-recycle",
      title: "분리수거 내놓기",
      memo: "종이·플라스틱 따로",
      assigneeMemberId: jiwoo ?? mom,
      dueDate: yesterday,
      status: "todo",
      createdByMemberId: mom,
      createdAt: base(addDays(today, -3), "18:00"),
      updatedAt: base(addDays(today, -3), "18:00"),
      completedAt: null,
      completedByMemberId: null,
      seed: true,
    },
    {
      id: "seed-errand",
      title: "우유 사오기",
      memo: "심부름 · 편의점",
      assigneeMemberId: hajun ?? mom,
      dueDate: null,
      status: "todo",
      createdByMemberId: dad ?? mom,
      createdAt: base(yesterday, "08:30"),
      updatedAt: base(yesterday, "08:30"),
      completedAt: null,
      completedByMemberId: null,
      seed: true,
    },
    {
      id: "seed-plants",
      title: "화분 물 주기",
      memo: "",
      assigneeMemberId: dad ?? mom,
      dueDate: addDays(today, 2),
      status: "todo",
      createdByMemberId: dad ?? mom,
      createdAt: base(today, "07:00"),
      updatedAt: base(today, "07:00"),
      completedAt: null,
      completedByMemberId: null,
      seed: true,
    },
  ]
}
