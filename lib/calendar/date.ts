import { CALENDAR_DEFAULT_TIME_ZONE } from "./config"
import type { DateKey, TimeKey } from "./types"

/**
 * 날짜 전용 값(YYYY-MM-DD)은 Date 객체로 바꾸지 않고 문자열·정수로 다룬다.
 * 포맷이 필요할 때만 UTC 정오 기준 Date를 만들어 하루가 밀리지 않게 한다.
 */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

export function pad2(n: number) {
  return String(n).padStart(2, "0")
}

export function toDateKey(year: number, month: number, day: number): DateKey {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

export function parseDateKey(key: string): { year: number; month: number; day: number } | null {
  const m = DATE_RE.exec(key)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (month < 1 || month > 12) return null
  if (day < 1 || day > daysInMonth(year, month)) return null
  return { year, month, day }
}

export function isValidDateKey(key: string) {
  return parseDateKey(key) !== null
}

export function isValidTimeKey(key: string) {
  return TIME_RE.test(key)
}

export function daysInMonth(year: number, month: number) {
  // month: 1~12. 다음 달 0일 = 이 달 마지막 날 (윤년 포함)
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** 0=일요일 */
export function weekdayOf(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

/** 주어진 시간대의 오늘 날짜 키. toISOString()처럼 UTC로 자르지 않는다. */
export function todayKey(now: Date = new Date(), timeZone = CALENDAR_DEFAULT_TIME_ZONE): DateKey {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, p) => ((acc[p.type] = p.value), acc), {})
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function addDays(key: DateKey, days: number): DateKey {
  const p = parseDateKey(key)
  if (!p) return key
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + days))
  return toDateKey(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

export function addMonths(year: number, month: number, delta: number) {
  const idx = year * 12 + (month - 1) + delta
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 }
}

/** 월간 달력 칸. 앞뒤 빈칸은 null. 일요일 시작, 6주까지. */
export function monthGrid(year: number, month: number): (DateKey | null)[][] {
  const lead = weekdayOf(year, month, 1)
  const total = daysInMonth(year, month)
  const cells: (DateKey | null)[] = Array(lead).fill(null)
  for (let d = 1; d <= total; d++) cells.push(toDateKey(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (DateKey | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

const monthTitle = new Intl.DateTimeFormat("ko-KR", { timeZone: "UTC", year: "numeric", month: "long" })
const dayShort = new Intl.DateTimeFormat("ko-KR", { timeZone: "UTC", month: "long", day: "numeric", weekday: "short" })
const dayFull = new Intl.DateTimeFormat("ko-KR", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric", weekday: "long" })
const dayWeekday = new Intl.DateTimeFormat("ko-KR", { timeZone: "UTC", weekday: "long" })

function utcNoon(key: DateKey) {
  const p = parseDateKey(key)
  return p ? new Date(Date.UTC(p.year, p.month - 1, p.day, 12)) : null
}

/** 2026년 11월 */
export function formatMonthTitle(year: number, month: number) {
  return monthTitle.format(new Date(Date.UTC(year, month - 1, 1, 12)))
}
/** 11월 1일 (일) */
export function formatDateKey(key: DateKey) {
  const d = utcNoon(key)
  return d ? dayShort.format(d) : key
}
/** 2026년 11월 1일 일요일 */
export function formatDateKeyFull(key: DateKey) {
  const d = utcNoon(key)
  return d ? dayFull.format(d) : key
}
/** 일요일 */
export function formatWeekday(key: DateKey) {
  const d = utcNoon(key)
  return d ? dayWeekday.format(d) : ""
}

/** "19:00" → "오후 7:00" */
export function formatTimeKey(time: TimeKey) {
  const m = TIME_RE.exec(time)
  if (!m) return time
  const h = Number(m[1])
  return `${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${m[2]}`
}

/** 시간 비교용 분 단위 정수 */
export function timeToMinutes(time: TimeKey) {
  const m = TIME_RE.exec(time)
  return m ? Number(m[1]) * 60 + Number(m[2]) : Number.NaN
}

/** 일정 시각 라벨: 종일 / 오후 7:00 – 오후 8:30 */
export function formatEventTime(e: { allDay: boolean; startTime: string | null; endTime: string | null }) {
  if (e.allDay || !e.startTime || !e.endTime) return "종일"
  return `${formatTimeKey(e.startTime)} – ${formatTimeKey(e.endTime)}`
}
