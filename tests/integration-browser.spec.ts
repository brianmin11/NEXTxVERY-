import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import type { FamilyView } from '../src/contracts/family';

const base = process.env.BASE_URL || 'http://localhost:3111';
const password = `Local-test-${randomUUID()}!`;
async function signup(page: Page, name: string) {
  await page.goto(`${base}/login`);
  await page.getByRole('button', { name: '처음이에요 · 계정 만들기' }).click();
  await page.getByLabel('이름', { exact: true }).fill(name);
  await page.getByLabel('이메일', { exact: true }).fill(`qa-${randomUUID()}@example.test`);
  await page.getByLabel('비밀번호', { exact: true }).fill(password);
  await page.getByRole('button', { name: '계정 만들기', exact: true }).click();
  await expect(page).toHaveURL(/\/(?:home|more)(?:\?|$)/);
}
async function view(page: Page) {
  const response = await page.request.get(`${base}/api/family`);
  expect(response.status()).toBe(200);
  return response.json() as Promise<FamilyView>;
}
async function makeFamily(page: Page) {
  await page.goto(`${base}/more`);
  await page.getByLabel('가족 이름', { exact: true }).fill('브라우저 합성 가족');
  await page.getByRole('button', { name: '우리집 만들기', exact: true }).click();
  await expect(page.getByLabel('가족 초대 코드', { exact: true })).toBeVisible();
  return page.getByLabel('가족 초대 코드', { exact: true }).inputValue();
}

test('two real browser login sessions join one family, save schedule, reload, and keep private input private', async ({ browser }) => {
  const aContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const bContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const a = await aContext.newPage(), b = await bContext.newPage();
  try {
    await signup(a, '브라우저 A'); const code = await makeFamily(a);
    await signup(b, '브라우저 B');
    await b.goto(`${base}/more`);
    await b.getByLabel('초대 코드', { exact: true }).fill(code);
    await b.getByRole('button', { name: '가족에 참여하기', exact: true }).click();
    await expect(b.getByLabel('가족 초대 코드', { exact: true })).toHaveValue(code);
    const aView = await view(a), bView = await view(b);
    expect(aView.viewer.id).not.toBe(bView.viewer.id);
    expect(aView.household?.id).toBe(bView.household?.id);

    await a.goto(`${base}/calendar`);
    const title = `브라우저 저장 확인 ${randomUUID().slice(0, 8)}`;
    await a.getByLabel('일정 이름', { exact: true }).fill(title);
    const day = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    await a.getByLabel('시작', { exact: true }).fill(`${day}T17:00`);
    await a.getByLabel('종료', { exact: true }).fill(`${day}T18:00`);
    await a.getByRole('checkbox', { name: '브라우저 A', exact: true }).check();
    await a.getByRole('checkbox', { name: '브라우저 B', exact: true }).check();
    await a.getByRole('button', { name: '일정 저장', exact: true }).click();
    await expect(a.getByText(title, { exact: true })).toBeVisible();
    await a.reload(); await expect(a.getByText(title, { exact: true })).toBeVisible();
    await b.goto(`${base}/calendar`); await expect(b.getByText(title, { exact: true })).toBeVisible();
    const saved = (await view(b)).schedules.find(item => item.title === title);
    expect(saved?.revision).toBe(1);
    expect(new Set(saved?.participantIds)).toEqual(new Set([aView.viewer.id, bView.viewer.id]));

    await a.goto(`${base}/home/heart`);
    await a.getByRole('button', { name: '새 이야기', exact: true }).click();
    const secret = `화면 비공개 표식 ${randomUUID()}`;
    await a.getByLabel('내 이야기', { exact: true }).fill(secret);
    await a.getByRole('button', { name: '개인 공간에 저장', exact: true }).click();
    await expect(a.getByRole('button', { name: '내 표현 정리하기', exact: true })).toBeVisible();
    const privateItem = (await view(a)).privateEntries.find(item => item.text === secret);
    expect(privateItem).toBeTruthy();
    expect(JSON.stringify(await view(b))).not.toContain(secret);
    await a.reload(); expect(JSON.stringify(await view(a))).toContain(secret);

    // Keyboard focus and narrow layout are checked independently from data assertions.
    await a.keyboard.press('Tab');
    expect(await a.evaluate(() => document.activeElement !== document.body)).toBe(true);
    expect(await a.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await a.screenshot({ path: test.info().outputPath('private-mobile-390.png'), fullPage: true });
    await b.screenshot({ path: test.info().outputPath('calendar-desktop.png'), fullPage: true });
  } finally { await aContext.close(); await bContext.close(); }
});

test('unconfigured provider fails visibly while preserved private input and calendar stay usable', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await signup(page, '오류 복구 검증'); await makeFamily(page);
    test.skip((await view(page)).modelMode !== 'unconfigured', 'This no-paid-call test requires a server with no provider key.');
    await page.goto(`${base}/home/heart`);
    await page.getByRole('button', { name: '새 이야기', exact: true }).click();
    const secret = `오류 후 보존 ${randomUUID()}`;
    await page.getByLabel('내 이야기', { exact: true }).fill(secret);
    await page.getByRole('button', { name: '개인 공간에 저장', exact: true }).click();
    await expect(page.getByRole('button', { name: '내 표현 정리하기', exact: true })).toBeDisabled();
    const entry = (await view(page)).privateEntries.find(item => item.text === secret)!;
    const failed = await page.request.post(`${base}/api/family`, { headers: { Origin: base }, data: { type: 'private.analyze', id: entry.id, expectedRevision: entry.revision, requestId: randomUUID() } });
    expect(failed.status()).toBe(503);
    expect((await failed.json()).error).toBeTruthy();
    const state = await view(page);
    expect(state.privateEntries.find(item => item.text === secret)?.personal).toBeUndefined();
    expect(state.coordinations).toHaveLength(0);
    await page.reload(); expect(JSON.stringify(await view(page))).toContain(secret);
    await page.goto(`${base}/calendar`); await expect(page.getByLabel('일정 이름', { exact: true })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('recovered-calendar-mobile.png'), fullPage: true });
  } finally { await context.close(); }
});

test('HTTP rejects unauthenticated and cross-origin mutation requests before invoking models', async ({ request }) => {
  const anonymous = await request.get(`${base}/api/family`);
  expect(anonymous.status()).toBe(401);
  const crossOrigin = await request.post(`${base}/api/family`, {
    headers: { Origin: 'https://untrusted.example.test' },
    data: { type: 'household.create', name: 'must not create', requestId: randomUUID() },
  });
  expect([401, 403]).toContain(crossOrigin.status());
});
