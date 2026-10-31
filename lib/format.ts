// 날짜·시간 표시는 서버/브라우저 시간대 차이로 하이드레이션이 어긋나지 않도록 시간대를 고정한다.
const TIME_ZONE = "Asia/Seoul"

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: TIME_ZONE,
  month: "long",
  day: "numeric",
  weekday: "short",
})

const fullDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
})

// ICU 78(Node 24)은 ko-KR 12시간제를 "PM 7:00"으로 출력해 런타임마다 결과가 달라진다.
// 24시간제 숫자만 받아 오전/오후를 직접 붙인다.
const timePartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
  hourCycle: "h23",
})

/** 10월 31일 (토) */
export function formatDate(date: Date) {
  return dateFormatter.format(date)
}

/** 2026년 10월 31일 토요일 */
export function formatFullDate(date: Date) {
  return fullDateFormatter.format(date)
}

/** 오후 7:00 */
export function formatTime(date: Date) {
  const parts = timePartsFormatter.formatToParts(date)
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0)
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00"
  const period = hour < 12 ? "오전" : "오후"
  return `${period} ${hour % 12 || 12}:${minute}`
}
