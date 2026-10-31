import { test, expect, type BrowserContext } from "@playwright/test"
import { randomUUID } from "node:crypto"

// Uses real cookie sessions and the actual SQLite-backed HTTP server. No model calls.
const baseURL = process.env.BASE_URL || "http://localhost:3120"
const requestId = () => randomUUID()
async function api(
  context: BrowserContext,
  method: string,
  path: string,
  data?: unknown
) {
  const response = await context.request.fetch(`${baseURL}/api/v2/${path}`, {
    method,
    data,
    headers: { Origin: new URL(baseURL).origin },
  })
  expect(
    response.ok(),
    `${method} ${path}: ${await response.text()}`
  ).toBeTruthy()
  return (await response.json()).data
}
async function signup(context: BrowserContext, name: string) {
  const response = await context.request.post(
    `${baseURL}/api/auth/sign-up/email`,
    {
      headers: { Origin: new URL(baseURL).origin },
      data: {
        name,
        email: `qa-${randomUUID()}@example.test`,
        password: `Qa-${randomUUID()}!`,
      },
    }
  )
  expect(response.ok(), await response.text()).toBeTruthy()
  return (await response.json()).user
}

test("mobile browser calendar save persists across reload and another authenticated family member", async ({
  browser,
}) => {
  const a = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const b = await browser.newContext({ viewport: { width: 390, height: 844 } })
  try {
    const userA = await signup(a, "일정 작성자"),
      userB = await signup(b, "가족 구성원")
    await api(a, "POST", "families", {
      name: "QA 가족",
      requestId: requestId(),
    })
    const invite = await api(a, "POST", "family/invites", {
      requestId: requestId(),
    })
    await api(b, "POST", "family/join", {
      inviteCode: invite.inviteCode,
      requestId: requestId(),
    })
    const page = await a.newPage()
    await page.goto(`${baseURL}/calendar`)
    await page.getByRole("button", { name: "일정 추가", exact: true }).click()
    const title = `함께 저녁 ${randomUUID().slice(0, 6)}`
    await page.getByLabel("제목", { exact: false }).fill(title)
    await page.getByLabel("시작", { exact: false }).fill("19:00")
    await page.getByLabel("종료", { exact: false }).fill("20:00")
    await page.getByRole("button", { name: "추가", exact: true }).click()
    await expect(page.getByText(title, { exact: true })).toBeVisible()
    const stored = await api(a, "GET", "calendar/events")
    const event = stored.find((item: { title: string }) => item.title === title)
    expect(event).toBeTruthy()
    expect(event.createdByMemberId).toBe(userA.id)
    await page.reload()
    await expect(page.getByText(title, { exact: true })).toBeVisible()
    const pageB = await b.newPage()
    await pageB.goto(`${baseURL}/calendar`)
    await expect(pageB.getByText(title, { exact: true })).toBeVisible()
    const sessionB = await api(b, "GET", "session")
    expect(sessionB.viewer.id).toBe(userB.id)
    const denied = await b.request.patch(
      `${baseURL}/api/v2/calendar/events/${event.id}`,
      {
        headers: { Origin: new URL(baseURL).origin },
        data: {
          fields: { ...event, title: "타인 수정" },
          expectedRevision: event.revision,
          requestId: requestId(),
        },
      }
    )
    expect(denied.status()).toBe(403)
    await page.screenshot({
      path: test.info().outputPath("calendar-mobile.png"),
      fullPage: true,
    })
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.screenshot({
      path: test.info().outputPath("calendar-desktop.png"),
      fullPage: true,
    })
  } finally {
    await a.close()
    await b.close()
  }
})

test("direct inbox URL marks read, excludes outsiders, and rejects cross-origin mutations", async ({
  browser,
}) => {
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
    browser.newContext(),
  ])
  const [a, b, c] = contexts
  try {
    const sender = await signup(a, "메시지 작성자"),
      receiver = await signup(b, "메시지 수신자")
    await signup(c, "다른 가족")
    await api(a, "POST", "families", {
      name: "마음 가족",
      requestId: requestId(),
    })
    const invite = await api(a, "POST", "family/invites", {
      requestId: requestId(),
    })
    await api(b, "POST", "family/join", {
      inviteCode: invite.inviteCode,
      requestId: requestId(),
    })
    await api(c, "POST", "families", {
      name: "별도 가족",
      requestId: requestId(),
    })
    const message = await api(a, "POST", "mind/messages", {
      text: "직접 다듬고 확인한 문장",
      recipientMemberId: receiver.id,
      requestId: requestId(),
    })
    expect(message.fromId).toBe(sender.id)
    const page = await b.newPage()
    await page.goto(`${baseURL}/inbox/${message.id}`)
    await expect(
      page.getByText("직접 다듬고 확인한 문장", { exact: true })
    ).toBeVisible()
    await expect
      .poll(
        async () => (await api(b, "GET", `mind/messages/${message.id}`)).status
      )
      .toBe("read")
    const denied = await c.request.get(
      `${baseURL}/api/v2/mind/messages/${message.id}`
    )
    expect(denied.status()).toBe(404)
    const csrf = await a.request.post(`${baseURL}/api/v2/mind/messages`, {
      headers: { Origin: "https://untrusted.example" },
      data: {
        text: "차단할 문장",
        recipientMemberId: receiver.id,
        requestId: requestId(),
      },
    })
    expect(csrf.status()).toBe(403)
    const ai = await a.request.post(`${baseURL}/api/v2/mind/suggestions`, {
      headers: { Origin: new URL(baseURL).origin },
      data: {
        rawText: "개인 원문",
        recipientMemberId: receiver.id,
        clientDraftVersion: 1,
      },
    })
    expect(ai.status()).toBe(503)
  } finally {
    await Promise.all(contexts.map((context) => context.close()))
  }
})

test("chores, uploaded photos and manually refined messages survive real two-account workflows", async ({
  browser,
}) => {
  const a = await browser.newContext({ viewport: { width: 390, height: 844 } }),
    b = await browser.newContext({ viewport: { width: 390, height: 844 } })
  try {
    await signup(a, "작성 가족")
    const receiver = await signup(b, "담당 가족")
    await api(a, "POST", "families", {
      name: "생활 QA 가족",
      requestId: requestId(),
    })
    const invite = await api(a, "POST", "family/invites", {
      requestId: requestId(),
    })
    await api(b, "POST", "family/join", {
      inviteCode: invite.inviteCode,
      requestId: requestId(),
    })
    const page = await a.newPage(),
      pageB = await b.newPage()
    const title = `설거지 ${randomUUID().slice(0, 6)}`
    await page.goto(`${baseURL}/chores/new`)
    await page.getByLabel("할 일", { exact: false }).fill(title)
    await page
      .getByRole("radiogroup", { name: "담당할 가족" })
      .getByRole("radio", { name: "담당 가족" })
      .click()
    await page.getByRole("button", { name: "추가", exact: true }).click()
    await expect(page.getByRole("link", { name: "할 일 보기" })).toBeVisible()
    await pageB.goto(`${baseURL}/chores`)
    await pageB
      .getByRole("checkbox", { name: `'${title}' 완료로 표시`, exact: true })
      .click()
    await expect
      .poll(
        async () =>
          (await api(b, "GET", "chores")).find(
            (x: { title: string }) => x.title === title
          )?.status
      )
      .toBe("done")
    await pageB.reload()
    await pageB.getByRole("tab", { name: "완료", exact: true }).click()
    await expect(
      pageB.getByRole("checkbox", { name: `'${title}' 완료 취소`, exact: true })
    ).toBeChecked()

    const sharp = (await import("sharp")).default
    const image = await sharp({
      create: { width: 32, height: 24, channels: 3, background: "#79a" },
    })
      .png()
      .toBuffer()
    await page.goto(`${baseURL}/memories/new`)
    await page
      .locator("input[type=file]")
      .setInputFiles({
        name: "family.png",
        mimeType: "image/png",
        buffer: image,
      })
    const caption = `가족 사진 ${randomUUID().slice(0, 6)}`
    await page.getByLabel("설명 (선택)").fill(caption)
    await page.getByRole("button", { name: "추억 등록", exact: true }).click()
    await expect
      .poll(async () =>
        (await api(a, "GET", "memories")).posts.some(
          (x: { caption: string }) => x.caption === caption
        )
      )
      .toBe(true)
    const memories = await api(a, "GET", "memories")
    const post = memories.posts.find(
      (x: { caption: string }) => x.caption === caption
    )
    await pageB.goto(`${baseURL}/memories/${post.id}`)
    await expect(pageB.getByText(caption, { exact: true })).toBeVisible()
    await pageB.reload()
    await expect(pageB.getByText(caption, { exact: true })).toBeVisible()
    const asset = await b.request.get(
      `${baseURL}/api/v2/memories/assets/${post.assetId}/content`
    )
    expect(asset.ok()).toBeTruthy()
    expect(asset.headers()["content-type"]).toMatch(/^image\//)

    await page.goto(`${baseURL}/mind`)
    const raw = `다른 사람에게 보이면 안 되는 원문 ${randomUUID()}`
    await page.getByRole("radio", { name: "담당 가족" }).click()
    await page.getByPlaceholder("지금 느끼는 그대로 적어도 괜찮아요.").fill(raw)
    await page.getByRole("button", { name: "다음: 전달 문장 다듬기" }).click()
    const failed = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/v2/mind/suggestions") &&
        response.request().method() === "POST"
    )
    await page
      .getByRole("button", { name: "AI 제안 받기", exact: true })
      .click()
    expect((await failed).status()).toBe(503)
    const outgoing = `함께 이야기해요 ${randomUUID().slice(0, 6)}`
    await page
      .getByPlaceholder("상대에게 보일 문장을 직접 써 주세요.")
      .fill(outgoing)
    await page
      .getByRole("button", { name: "전달 내용 확인", exact: true })
      .click()
    await page
      .getByRole("button", { name: "확인하고 보내기", exact: true })
      .click()
    await expect
      .poll(async () =>
        (await api(b, "GET", "mind/messages")).some(
          (x: { text: string }) => x.text === outgoing
        )
      )
      .toBe(true)
    const messages = await api(b, "GET", "mind/messages")
    expect(JSON.stringify(messages)).not.toContain(raw)
    const sent = messages.find((x: { text: string }) => x.text === outgoing)
    expect(sent.toId).toBe(receiver.id)
    await pageB.goto(`${baseURL}/inbox/${sent.id}`)
    await expect(pageB.getByText(outgoing, { exact: true })).toBeVisible()
    await pageB.screenshot({
      path: test.info().outputPath("mind-mobile.png"),
      fullPage: true,
    })
  } finally {
    await a.close()
    await b.close()
  }
})
