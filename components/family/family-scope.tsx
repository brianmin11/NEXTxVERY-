"use client"

import { CalendarProvider } from "@/components/calendar/calendar-provider"
import { ChoresProvider } from "@/components/chores/chores-provider"
import { MemoriesProvider } from "@/components/memories/memories-provider"
import { MindProvider } from "@/components/mind/mind-provider"

import { useFamily } from "./family-provider"

/**
 * 가족 단위 데모 상태(마음·일정·사진·집안일)를 현재 가족 id로 묶는다.
 * 가족을 만들거나 참여해 세션이 바뀌면 key가 바뀌어 provider가 다시 마운트되고,
 * 이전 가족의 데이터는 화면에 남지 않는다. seed 예시는 데모 기본 가족에만 넣는다.
 */
export function FamilyScope({ children }: { children: React.ReactNode }) {
  const { family } = useFamily()
  const seeded = family.seed === true
  return (
    <MindProvider key={family.id} seeded={seeded}>
      <CalendarProvider seeded={seeded}>
        <MemoriesProvider seeded={seeded}>
          <ChoresProvider seeded={seeded}>{children}</ChoresProvider>
        </MemoriesProvider>
      </CalendarProvider>
    </MindProvider>
  )
}
