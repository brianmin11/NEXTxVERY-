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

/** 모바일 월간 달력. 7열, 칸 최소 44px, 일정 있는 날은 점 + 접근 가능한 개수 설명. */
export function MonthGrid({ year, month, selected, today, countsByDate, onSelect }: MonthGridProps) {
  const weeks = monthGrid(year, month)
  return (
    <div role="grid" aria-label={`${formatMonthTitle(year, month)} 달력`} className="flex flex-col gap-1">
      <div role="row" className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d, i) => (
          <div
            key={d}
            role="columnheader"
            aria-label={WEEKDAY_FULL[i]}
            className="py-1 text-center text-xs font-medium text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} role="row" className="grid grid-cols-7 gap-1">
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
                    "flex aspect-square min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-lg text-sm transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted",
                    isSelected && "bg-primary font-semibold text-primary-foreground hover:bg-primary/90",
                    isToday && !isSelected && "font-bold text-primary ring-1 ring-primary/40"
                  )}
                >
                  <span className="tabular-nums">{day}</span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-1.5 rounded-full",
                      count > 0 ? (isSelected ? "bg-primary-foreground" : "bg-primary") : "bg-transparent"
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
