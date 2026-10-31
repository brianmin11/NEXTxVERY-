"use client"

import { formatDateKey, formatMonthTitle, formatWeekday, monthGrid, parseDateKey } from "@/lib/calendar/date"
import type { DateKey } from "@/lib/calendar/types"
import { cn } from "@/lib/utils"

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"]
const WEEKDAY_FULL = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"]

type MonthGridProps = {
  year: number
  month: number
  selected: DateKey
  today: DateKey
  countsByDate: Map<DateKey, number>
  onSelect: (date: DateKey) => void
}

/**
 * 모바일 월간 달력(Figma). 7열, 칸 최소 44px, 선택한 날은 32px 초록 원, 오늘은 굵은 초록 글자,
 * 일정 있는 날은 코랄 점 + 접근 가능한 개수 설명.
 */
export function MonthGrid({ year, month, selected, today, countsByDate, onSelect }: MonthGridProps) {
  const weeks = monthGrid(year, month)
  return (
    // 칸 간격 2px: 360px에서도 칸이 45px 이상(44px 터치 기준)이 되도록
    <div role="grid" aria-label={`${formatMonthTitle(year, month)} 달력`} className="flex flex-col gap-0.5">
      <div role="row" className="grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((d, i) => (
          <div
            key={d}
            role="columnheader"
            aria-label={WEEKDAY_FULL[i]}
            className="py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} role="row" className="grid grid-cols-7 gap-0.5">
          {week.map((key, di) => {
            if (!key) return <div key={`empty-${wi}-${di}`} role="gridcell" aria-hidden="true" />
            const count = countsByDate.get(key) ?? 0
            const isSelected = key === selected
            const isToday = key === today
            const day = parseDateKey(key)?.day ?? 0
            return (
              <div key={key} role="gridcell" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => onSelect(key)}
                  aria-label={`${formatDateKey(key)} ${formatWeekday(key)}${isToday ? ", 오늘" : ""}${count > 0 ? `, 일정 ${count}개` : ""}`}
                  aria-current={isToday ? "date" : undefined}
                  aria-pressed={isSelected}
                  className={cn(
                    "relative flex min-h-11 w-full flex-col items-center justify-center rounded-full text-sm transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted",
                    isToday && !isSelected && "font-bold text-primary"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full tabular-nums",
                      isSelected && "bg-primary font-semibold text-primary-foreground"
                    )}
                  >
                    {day}
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full",
                      count > 0 ? "bg-deco-coral" : "bg-transparent"
                    )}
                  />
                </button>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
