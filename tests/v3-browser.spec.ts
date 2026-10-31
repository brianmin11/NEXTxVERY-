import { test, expect, type BrowserContext, type Page } from "@playwright/test"
import { randomUUID } from "node:crypto"
import type { CoordinationRoom } from "../src/contracts/coordination"

// Genuine Better Auth cookies + HTTP + persistent DB. Never click model generation in this suite.
const baseURL = process.env.BASE_URL || "http://localhost:3120"
const key = () => randomUUID()
async function response(
  context: BrowserContext,
  method: string,
  path: string,
  data?: unknown
) {
  return context.request.fetch(`${baseURL}/api/v2/${path}`, {
    method,
    data,
    headers: { Origin: new URL(baseURL).origin },
  })
}
async function api<T = unknown>(
  context: BrowserContext,
  method: string,
  path: string,
  data?: unknown
): Promise<T> {
  const result = await response(context, method, path, data)
  expect(result.ok(), `${method} ${path}: ${await result.text()}`).toBeTruthy()
  return (await result.json()).data as T
}
async function signup(context: BrowserContext, name: string) {
  const data = {
    name,
    email: `coordination-${key()}@example.test`,
    password: `Qa-${key()}!`,
  }
  const send = () =>
    context.request.post(`${baseURL}/api/auth/sign-up/email`, {
      headers: { Origin: new URL(baseURL).origin },
      data,
    })
  let result = await send()
  if (result.status() === 429) {
    const seconds = Number(result.headers()["retry-after"])
    await new Promise((resolve) =>
      setTimeout(
        resolve,
        (Number.isFinite(seconds) && seconds > 0
          ? Math.min(seconds + 1, 65)
          : 61) * 1000
      )
    )
    result = await send()
  }
  expect(result.ok(), await result.text()).toBeTruthy()
  return (await result.json()).user as { id: string }
}
async function openRoom(page: Page, title: string) {
  await page.goto(`${baseURL}/coordination`)
  await page
    .getByRole("button", { name: `조율 열기: ${title}`, exact: true })
    .click()
  await expect(
    page.getByLabel("가족에게 공유할 의견", { exact: true })
  ).toBeVisible()
}
async function confirmContribution(page: Page, text: string) {
  await page.getByLabel("가족에게 공유할 의견", { exact: true }).fill(text)
  await page
    .getByRole("button", { name: "의견 확인하고 공유", exact: true })
    .click()
  await expect(page.getByText(text, { exact: true })).toBeVisible()
}
test.setTimeout(240_000)

test("two authenticated family members review and accept a manual proposal before one persisted calendar update", async ({
  browser,
}) => {
  const contexts = await Promise.all([
    browser.newContext({ viewport: { width: 390, height: 844 } }),
    browser.newContext({ viewport: { width: 390, height: 844 } }),
    browser.newContext(),
  ])
  const [a, b, outsider] = contexts
  try {
    const userA = await signup(a, "조율 작성자"),
      userB = await signup(b, "조율 참여자")
    await signup(outsider, "다른 집 구성원")
    await api(a, "POST", "families", { name: "조율 QA 가족", requestId: key() })
    const invite = await api<{ inviteCode: string }>(
      a,
      "POST",
      "family/invites",
      { requestId: key() }
    )
    await api(b, "POST", "family/join", {
      inviteCode: invite.inviteCode,
      requestId: key(),
    })
    await api(outsider, "POST", "families", {
      name: "조율 외부 가족",
      requestId: key(),
    })
    const title = `함께 저녁 ${key().slice(0, 6)}`
    const event = await api<{ id: string; revision: number }>(
      a,
      "POST",
      "calendar/events",
      {
        fields: {
          title,
          category: "meal",
          date: "2028-02-29",
          allDay: false,
          startTime: "19:00",
          endTime: "20:00",
          location: "집",
          memo: "유지할 메모",
          participantIds: [userA.id, userB.id],
        },
        requestId: key(),
      }
    )
    const pageA = await a.newPage(),
      pageB = await b.newPage()
    await pageA.goto(`${baseURL}/coordination`)
    const select = pageA.getByRole("combobox", {
      name: "조율할 일정",
      exact: true,
    })
    await expect(select).toBeVisible()
    if (await select.evaluate((element) => element.tagName === "SELECT"))
      await select.selectOption(event.id)
    else {
      await select.click()
      await pageA.getByRole("option", { name: new RegExp(title) }).click()
    }
    await pageA.getByRole("button", { name: "조율 시작", exact: true }).click()
    await expect(
      pageA.getByLabel("가족에게 공유할 의견", { exact: true })
    ).toBeVisible()
    const rooms = await api<CoordinationRoom[]>(a, "GET", "coordinations")
    const room = rooms.find((item) => item.event.id === event.id)!
    expect(room).toBeTruthy()
    const foreign = await response(outsider, "GET", `coordinations/${room.id}`)
    expect(foreign.status()).toBe(404)
    const csrf = await a.request.post(
      `${baseURL}/api/v2/coordinations/${room.id}/contributions`,
      {
        headers: { Origin: "https://untrusted.example" },
        data: {
          text: "차단할 의견",
          expectedRevision: room.revision,
          requestId: key(),
        },
      }
    )
    expect(csrf.status()).toBe(403)
    await confirmContribution(pageA, "20시에 저녁을 함께 먹고 싶어요")
    await openRoom(pageB, title)
    await confirmContribution(pageB, "20시에는 집에 도착할 수 있어요")
    await pageA.getByRole("button", { name: "새로고침", exact: true }).click()
    await expect(
      pageA.getByText("20시에는 집에 도착할 수 있어요", { exact: true })
    ).toBeVisible()
    const summary = `20시에 함께 저녁 먹기 ${key().slice(0, 6)}`
    await pageA.getByLabel("제안 내용", { exact: true }).fill(summary)
    await pageA.getByLabel("변경할 날짜", { exact: true }).fill("2028-02-29")
    await pageA.getByLabel("시작 시간", { exact: true }).fill("20:00")
    await pageA.getByLabel("종료 시간", { exact: true }).fill("21:00")
    // Keyboard submits the same explicit publish action.
    await pageA
      .getByRole("button", { name: "이 제안을 공유", exact: true })
      .focus()
    await pageA.keyboard.press("Enter")
    await expect(pageA.getByText(summary, { exact: true })).toBeVisible()
    const beforeConsent = await api<CoordinationRoom>(
      a,
      "GET",
      `coordinations/${room.id}`
    )
    expect(beforeConsent.decisions).toHaveLength(0)
    const premature = await response(
      a,
      "POST",
      `coordinations/${room.id}/apply`,
      { expectedRevision: beforeConsent.revision, requestId: key() }
    )
    expect(premature.status()).toBe(409)
    await pageA
      .getByRole("button", { name: "이 제안 수락", exact: true })
      .click()
    await pageB.getByRole("button", { name: "새로고침", exact: true }).click()
    await expect(pageB.getByText(summary, { exact: true })).toBeVisible()
    await pageB
      .getByRole("button", { name: "이 제안 수락", exact: true })
      .click()
    await expect
      .poll(
        async () =>
          (
            await api<CoordinationRoom>(a, "GET", `coordinations/${room.id}`)
          ).decisions.filter((decision) => decision.decision === "accept")
            .length
      )
      .toBe(2)
    const accepted = await api<CoordinationRoom>(
      a,
      "GET",
      `coordinations/${room.id}`
    )
    const forbidden = await response(
      b,
      "POST",
      `coordinations/${room.id}/apply`,
      { expectedRevision: accepted.revision, requestId: key() }
    )
    expect(forbidden.status()).toBe(403)
    await pageA.getByRole("button", { name: "새로고침", exact: true }).click()
    await pageA
      .getByRole("button", { name: "일정에 반영", exact: true })
      .click()
    await expect
      .poll(
        async () =>
          (await api<CoordinationRoom>(a, "GET", `coordinations/${room.id}`))
            .status
      )
      .toBe("applied")
    const saved = await api<{
      id: string
      revision: number
      startTime: string
      endTime: string
      memo: string
    }>(b, "GET", `calendar/events/${event.id}`)
    expect(saved.id).toBe(event.id)
    expect(saved.revision).toBe(event.revision + 1)
    expect(saved.startTime).toBe("20:00")
    expect(saved.endTime).toBe("21:00")
    expect(saved.memo).toBe("유지할 메모")
    expect((await api<unknown[]>(b, "GET", "calendar/events")).length).toBe(1)
    await pageA.reload()
    await pageA
      .getByRole("button", { name: `조율 열기: ${title}`, exact: true })
      .click()
    await expect(pageA.getByText(summary, { exact: true })).toBeVisible()
    await pageA.screenshot({
      path: test.info().outputPath("coordination-mobile.png"),
      fullPage: true,
    })
    await pageA.setViewportSize({ width: 1280, height: 900 })
    await pageA.screenshot({
      path: test.info().outputPath("coordination-desktop.png"),
      fullPage: true,
    })
    await pageB.reload()
    await pageB
      .getByRole("button", { name: `조율 열기: ${title}`, exact: true })
      .click()
    await pageB.getByRole("button", { name: "동의 철회", exact: true }).click()
    await pageB.getByRole("button", { name: "철회 확인", exact: true }).click()
    await expect
      .poll(
        async () =>
          (await api<CoordinationRoom>(b, "GET", `coordinations/${room.id}`))
            .status
      )
      .toBe("withdrawn")
    expect(
      (
        await api<{ startTime: string }>(
          a,
          "GET",
          `calendar/events/${event.id}`
        )
      ).startTime
    ).toBe("20:00")
  } finally {
    await Promise.all(contexts.map((context) => context.close()))
  }
})
