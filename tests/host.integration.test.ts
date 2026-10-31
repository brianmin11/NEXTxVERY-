import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEngine, createRunner, RelationshipError, type ModelAdapter, type ModelRequest, type RunOptions, type AgreementDraft } from '@family-os/relationship-ai';
import { openDatabase } from '../src/lib/server/database';
import { createFamilyService } from '../src/lib/server/family-service';
import type { Actor, Command, Coordination } from '../src/contracts/family';

type Input = { [K in Command['type']]: Omit<Extract<Command, { type: K }>, 'requestId'> }[Command['type']];
const NOW = '2028-01-03T00:00:00.000Z';
const A: Actor = { id: 'member-a', name: '테스트 구성원 A', email: 'a@example.test' };
const B: Actor = { id: 'member-b', name: '테스트 구성원 B', email: 'b@example.test' };
const C: Actor = { id: 'member-c', name: '다른 가족 구성원', email: 'c@example.test' };
const SECRET_A = '개인 원문 전용 표식 73da';
const SECRET_B = '두 번째 개인 원문 전용 표식 64bc';
const options: RunOptions = { maxCalls: 1, maxRetries: 0, maxInputBytes: 100000, maxOutputTokens: 3000, timeoutMs: 5000, maxCostUsd: 2, price: { version: 'TEST_ONLY', inputPerMillion: 1, outputPerMillion: 1 } };

type Projection = {
  scope: { actorId: string; participantIds: string[] };
  route: 'reflect' | 'share' | 'coordinate';
  current: { id: string; revision: number; text: string };
  settings: { id: string; revision: number; recipients: string[]; purpose: string };
  cards: { id: string; revision: number; senderId: string; text: string }[];
  schedules: { id: string; start: string; end: string }[];
  prior: AgreementDraft;
  requiredRevision: number;
};

/** Deliberately injected test-only provider; never imported by application code. */
class ContractAdapter implements ModelAdapter {
  readonly name = 'TEST_ONLY_CONTRACT';
  readonly model = 'contract-fixture';
  readonly requests: ModelRequest[] = [];
  before?: (request: ModelRequest) => Promise<void>;
  failNext?: RelationshipError;
  privateSupport = false;
  async generate(request: ModelRequest) {
    this.requests.push(request);
    if (this.before) await this.before(request);
    if (this.failNext) { const failure = this.failNext; this.failNext = undefined; throw failure; }
    const p = request.input as Projection;
    let value: unknown;
    if (request.stage === 'personal') {
      value = { response: '입력한 요청을 정리했어요.', claims: [{ speakerId: p.scope.actorId, kind: 'want', statement: p.current.text, epistemicStatus: 'self_report', evidence: [{ sourceId: p.current.id, revision: p.current.revision, quote: p.current.text }] }], unknowns: [], questions: [], disposition: this.privateSupport ? 'private_support' : 'ready', suggestedRoute: this.privateSupport ? 'reflect' : p.route };
    } else if (request.stage === 'share') {
      // settings contains constraintsOnly; output schema intentionally excludes it.
      const { id, revision, recipients, purpose } = p.settings;
      value = { schemaVersion: '1.0', id, revision, recipients, purpose, status: 'draft', exactText: '일정 조정을 요청하고 싶어요.', reviewItems: [], safetyDisposition: this.privateSupport ? 'private_support' : 'ordinary' };
    } else if (request.stage === 'issue') {
      value = { commonGoals: [], differingExpectations: [], conflicts: [], unknowns: [], questions: [], unrepresentedParticipantIds: [] };
    } else if (request.stage === 'agreement') {
      const source = p.cards[0];
      const schedule = p.schedules[0];
      assert.ok(source, 'joint inference must have an approved card');
      value = { schemaVersion: '1.0', id: p.settings.id, revision: p.settings.revision, status: 'draft', parties: p.scope.participantIds, summary: '각자 확인한 시간으로 일정 변경을 검토해요.', options: ['변경 시간을 함께 확인하기'], actions: [{ kind: 'schedule_update', targetId: schedule?.id ?? null, assigneeId: p.scope.actorId, description: '공유 일정 변경 검토', start: schedule?.start ?? null, end: schedule?.end ?? null, deadline: null, recurrence: 'none', weekdays: [], until: null, preparation: null, followup: null, exception: null, reminderRecipients: [], reminderAt: null, maxReminders: 0, basis: 'proposed', evidence: [{ sourceId: source.id, revision: source.revision, quote: source.text }], unresolvedFields: [] }], unknowns: [], changes: [], acceptanceInheritance: false };
    } else {
      value = { ...p.prior, revision: p.requiredRevision, status: 'draft', summary: `${p.prior.summary} 수정안을 확인해요.`, acceptanceInheritance: false };
    }
    return { value, model: this.model, inputTokens: 20, outputTokens: 30 };
  }
}

function setup(path = ':memory:') {
  const db = openDatabase(path);
  const adapter = new ContractAdapter();
  const service = createFamilyService({ db, engine: createEngine(createRunner(adapter)), runOptions: options, now: () => NOW, modelMode: 'test' });
  const command = (actor: Actor, input: Input, requestId = randomUUID()) => service.command(actor, { ...input, requestId } as Command);
  return { db, adapter, service, command };
}
type Harness = ReturnType<typeof setup>;
const coordination = (h: Harness, id: string, actor = A) => {
  const value = h.service.read(actor).coordinations.find((item: Coordination) => item.id === id);
  assert.ok(value, `coordination ${id} should be visible to its audience`);
  return value;
};
const privateEntry = (h: Harness, id: string, actor = A) => {
  const value = h.service.read(actor).privateEntries.find(item => item.id === id);
  assert.ok(value, 'owner private entry must exist'); return value;
};
async function family(h: Harness) {
  const result = await h.command(A, { type: 'household.create', name: '합성 검증 가족' });
  assert.ok(result.view.household);
  assert.ok(result.view.household.inviteCode.length >= 16);
  await h.command(B, { type: 'household.join', inviteCode: result.view.household.inviteCode });
  await h.command(C, { type: 'household.create', name: '별도 검증 가족' });
}
async function schedule(h: Harness, hour = 9, actor = A) {
  const result = await h.command(actor, { type: 'schedule.create', title: `기존 일정 ${hour}`, start: `2028-01-05T${String(hour).padStart(2, '0')}:00:00.000Z`, end: `2028-01-05T${String(hour + 1).padStart(2, '0')}:00:00.000Z`, participantIds: [A.id, B.id] });
  assert.ok(result.createdId); return result.createdId;
}
async function share(h: Harness, actor: Actor, recipient: Actor, existingCoordination?: string) {
  const created = await h.command(actor, { type: 'private.create', text: actor.id === A.id ? SECRET_A : SECRET_B, route: 'coordinate', coordinationId: existingCoordination });
  assert.ok(created.createdId);
  let entry = privateEntry(h, created.createdId, actor);
  await h.command(actor, { type: 'private.analyze', id: entry.id, expectedRevision: entry.revision });
  entry = privateEntry(h, entry.id, actor);
  await h.command(actor, { type: 'private.share', id: entry.id, expectedRevision: entry.revision, recipients: [recipient.id], constraintsOnly: true });
  entry = privateEntry(h, entry.id, actor);
  await h.command(actor, { type: 'share.approve', id: entry.id, expectedRevision: entry.revision, exactText: `${actor.name}: 함께 일정 시간을 바꾸고 싶어요.`, recipients: [recipient.id] });
  return { privateId: entry.id, coordinationId: entry.coordinationId };
}
async function proposed(h: Harness) {
  const first = await share(h, A, B);
  await share(h, B, A, first.coordinationId);
  const current = coordination(h, first.coordinationId);
  await h.command(A, { type: 'coordination.generate', id: current.id, expectedRevision: current.revision });
  return coordination(h, current.id);
}
async function resolve(h: Harness, id: string, targetId: string, hour = 14) {
  const current = coordination(h, id);
  await h.command(A, { type: 'plan.resolve', id, expectedRevision: current.revision, targetId, title: '함께 수락할 변경 일정', start: `2028-01-05T${String(hour).padStart(2, '0')}:00:00.000Z`, end: `2028-01-05T${String(hour + 1).padStart(2, '0')}:00:00.000Z`, participantIds: [A.id, B.id] });
  const result = coordination(h, id); assert.ok(result.plan); return result;
}
async function accept(h: Harness, id: string, actor: Actor) {
  const current = coordination(h, id, actor); assert.ok(current.plan);
  return h.command(actor, { type: 'plan.accept', id, expectedRevision: current.revision, planId: current.plan.id, planRevision: current.plan.revision, digest: current.plan.digest });
}
function applyCommand(c: Coordination): Input {
  assert.ok(c.plan);
  return { type: 'plan.apply', id: c.id, expectedRevision: c.revision, planId: c.plan.id, planRevision: c.plan.revision, digest: c.plan.digest };
}
const status = (...allowed: number[]) => (error: unknown) => {
  assert.ok(error && typeof error === 'object' && 'status' in error && 'code' in error, 'host failures must expose typed code/status');
  assert.ok(allowed.includes(Number(error.status)), `unexpected status ${String(error.status)} / ${String(error.code)}`);
  return true;
};

test('two participants approve exact shared text without leaking either private entry to the joint model or another account', async t => {
  const h = setup(); t.after(() => h.db.close()); await family(h); await schedule(h);
  const shared = await share(h, A, B);
  assert.equal(h.service.read(B).privateEntries.length, 0);
  assert.ok(!JSON.stringify(h.service.read(B)).includes(SECRET_A));
  assert.equal(h.service.read(C).coordinations.length, 0);
  const otherPrivate = await share(h, B, A, shared.coordinationId);
  assert.ok(!JSON.stringify(h.service.read(A)).includes(SECRET_B));
  let c = coordination(h, shared.coordinationId);
  await h.command(A, { type: 'coordination.generate', id: c.id, expectedRevision: c.revision });
  c = coordination(h, c.id);
  assert.equal(c.cards.length, 2); assert.equal(c.analysis?.unrepresentedParticipantIds.length, 0);
  const jointCalls = h.adapter.requests.filter(request => ['issue', 'agreement'].includes(request.stage));
  assert.equal(jointCalls.length, 2);
  for (const request of jointCalls) {
    const serialized = JSON.stringify(request.input);
    assert.ok(!serialized.includes(SECRET_A) && !serialized.includes(SECRET_B));
    assert.ok(!serialized.includes(shared.privateId) && !serialized.includes(otherPrivate.privateId));
  }
  await assert.rejects(h.command(B, { type: 'private.analyze', id: shared.privateId, expectedRevision: 1 }), status(403, 404));
  await assert.rejects(h.command(C, { type: 'coordination.generate', id: c.id, expectedRevision: c.revision }), status(403, 404));
});

test('proposed AI terms need explicit current-version acceptance from both actors; save is durable and exactly once', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'family-host-')); const path = join(dir, 'store.sqlite');
  const h = setup(path); t.after(() => { try { h.db.close(); } catch {} rmSync(dir, { recursive: true, force: true }); });
  await family(h); const targetId = await schedule(h); const c = await proposed(h);
  assert.equal(c.agreement?.actions[0].basis, 'proposed');
  await resolve(h, c.id, targetId);
  await assert.rejects(h.command(A, applyCommand(coordination(h, c.id))), status(409, 422));
  await accept(h, c.id, A);
  await assert.rejects(h.command(A, applyCommand(coordination(h, c.id))), status(409, 422));
  await accept(h, c.id, B);
  const before = coordination(h, c.id); assert.deepEqual(new Set(before.plan?.acceptedBy), new Set([A.id, B.id]));
  const input = applyCommand(before), requestId = randomUUID();
  await h.command(A, input, requestId);
  const first = h.service.read(A).schedules.find(item => item.id === targetId); assert.ok(first);
  assert.equal(first.start, '2028-01-05T14:00:00.000Z'); assert.equal(first.revision, 2);
  await h.command(A, input, requestId);
  assert.equal(h.service.read(A).schedules.find(item => item.id === targetId)?.revision, 2);
  assert.equal(coordination(h, c.id).agreement?.actions[0].basis, 'proposed', 'host resolution must not rewrite AI provenance');
  h.db.close();
  const reopened = setup(path);
  try {
    assert.equal(reopened.service.read(B).schedules.find(item => item.id === targetId)?.start, first.start);
    assert.equal(coordination(reopened, c.id, B).plan?.status, 'applied');
  } finally { reopened.db.close(); }
});

test('editing a resolved plan clears prior acceptances and rejects an old digest even with latest coordination revision', async t => {
  const h = setup(); t.after(() => h.db.close()); await family(h); const targetId = await schedule(h); const c = await proposed(h);
  const old = await resolve(h, c.id, targetId); assert.ok(old.plan);
  await accept(h, c.id, A);
  const revised = await resolve(h, c.id, targetId, 16); assert.ok(revised.plan);
  assert.equal(revised.plan.acceptedBy.length, 0);
  assert.notEqual(revised.plan.digest, old.plan.digest);
  await assert.rejects(h.command(B, { type: 'plan.accept', id: c.id, expectedRevision: revised.revision, planId: old.plan.id, planRevision: old.plan.revision, digest: old.plan.digest }), status(409));
  assert.equal(h.service.read(A).schedules.find(item => item.id === targetId)?.revision, 1);
});

test('revocation invalidates accepted but unapplied plan; approved text and private source do not reappear to recipients', async t => {
  const h = setup(); t.after(() => h.db.close()); await family(h); const targetId = await schedule(h); const c = await proposed(h);
  await resolve(h, c.id, targetId); await accept(h, c.id, A); await accept(h, c.id, B);
  const current = coordination(h, c.id); const card = current.cards.find(item => item.senderId === A.id); assert.ok(card);
  await h.command(A, { type: 'share.revoke', id: c.id, cardId: card.id, expectedRevision: current.revision });
  await assert.rejects(h.command(B, applyCommand(current)), status(409));
  const recipient = h.service.read(B);
  const revoked = recipient.coordinations.find(item => item.id === c.id)?.cards.find(item => item.id === card.id);
  assert.ok(!revoked || revoked.exactText === '', 'revoked contents must not remain in recipient DTO');
  assert.ok(!JSON.stringify(recipient).includes(SECRET_A));
  assert.equal(recipient.schedules.find(item => item.id === targetId)?.revision, 1);
});

test('revoking a source while model generation is in flight prevents late results from being published', async t => {
  const h = setup(); t.after(() => h.db.close()); await family(h); await schedule(h); const shared = await share(h, A, B);
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  let entered!: () => void; const started = new Promise<void>(resolve => { entered = resolve; });
  h.adapter.before = async request => { if (request.stage === 'issue') { entered(); await gate; } };
  const current = coordination(h, shared.coordinationId);
  const running = h.command(A, { type: 'coordination.generate', id: current.id, expectedRevision: current.revision });
  const outcome = running.then(value => ({ value }), error => ({ error }));
  await started;
  await h.command(A, { type: 'share.revoke', id: current.id, cardId: current.cards[0].id, expectedRevision: current.revision });
  release();
  const result = await outcome;
  assert.ok('error' in result); assert.ok(result.error && ['STALE_CONTEXT', 'CONFLICT', 'STALE_VERSION'].includes(result.error.code) || 'error' in result && result.error.status === 409);
  const latest = coordination(h, current.id);
  assert.ok(!latest.agreement && !latest.analysis, 'stale generation cannot become shared output');
});

test('two different target updates cannot concurrently reserve the same participant/time', async t => {
  const h = setup(); t.after(() => h.db.close()); await family(h); const firstId = await schedule(h, 9); const secondId = await schedule(h, 11);
  const first = await proposed(h); const second = await proposed(h);
  await resolve(h, first.id, firstId, 14); await resolve(h, second.id, secondId, 14);
  await accept(h, first.id, A); await accept(h, first.id, B); await accept(h, second.id, A); await accept(h, second.id, B);
  const results = await Promise.allSettled([h.command(A, applyCommand(coordination(h, first.id))), h.command(B, applyCommand(coordination(h, second.id, B)))]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(h.service.read(A).schedules.filter(item => item.start === '2028-01-05T14:00:00.000Z').length, 1);
});

test('manual calendar CRUD and resolved-plan execution enforce the same collision boundary', async t => {
  const h = setup(); t.after(() => h.db.close()); await family(h); const targetId = await schedule(h); const c = await proposed(h);
  await resolve(h, c.id, targetId); await accept(h, c.id, A); await accept(h, c.id, B);
  await h.command(B, { type: 'schedule.create', title: '새 충돌 일정', start: '2028-01-05T14:30:00.000Z', end: '2028-01-05T15:30:00.000Z', participantIds: [B.id] });
  await assert.rejects(h.command(A, applyCommand(coordination(h, c.id))), status(409, 422));
  assert.equal(h.service.read(A).schedules.find(item => item.id === targetId)?.revision, 1);
});

test('defer/decline use no new model call and block execution resolution', async t => {
  for (const action of ['defer', 'decline'] as const) {
    const h = setup(); t.after(() => h.db.close()); await family(h); const targetId = await schedule(h); const c = await proposed(h);
    const calls = h.adapter.requests.length;
    await h.command(B, { type: 'coordination.revise', id: c.id, expectedRevision: c.revision, instruction: '', action });
    assert.equal(h.adapter.requests.length, calls);
    assert.equal(coordination(h, c.id).agreement?.status, action === 'defer' ? 'deferred' : 'declined');
    await assert.rejects(resolve(h, c.id, targetId), status(409, 422));
  }
});

test('reflection and private support remain private; provider failure cannot become a successful draft', async t => {
  const h = setup(); t.after(() => h.db.close()); await family(h);
  const created = await h.command(A, { type: 'private.create', text: SECRET_A, route: 'reflect' }); assert.ok(created.createdId);
  let entry = privateEntry(h, created.createdId);
  await h.command(A, { type: 'private.analyze', id: entry.id, expectedRevision: entry.revision });
  entry = privateEntry(h, entry.id);
  await assert.rejects(h.command(A, { type: 'private.share', id: entry.id, expectedRevision: entry.revision, recipients: [B.id], constraintsOnly: true }));
  assert.equal(h.service.read(B).coordinations.length, 0);
  h.adapter.failNext = new RelationshipError('PROVIDER_ERROR');
  await assert.rejects(h.command(A, { type: 'private.analyze', id: entry.id, expectedRevision: entry.revision }));
  assert.equal(h.service.read(B).coordinations.length, 0);
  const support = await h.command(A, { type: 'private.create', text: SECRET_A, route: 'coordinate' }); assert.ok(support.createdId);
  h.adapter.privateSupport = true; entry = privateEntry(h, support.createdId);
  await h.command(A, { type: 'private.analyze', id: entry.id, expectedRevision: entry.revision }); entry = privateEntry(h, entry.id);
  await assert.rejects(h.command(A, { type: 'private.share', id: entry.id, expectedRevision: entry.revision, recipients: [B.id], constraintsOnly: true }));
  assert.equal(h.service.read(B).coordinations.length, 0);
  assert.ok(!JSON.stringify(h.service.read(B)).includes('private_support'));
});

test('wrong request payload cannot reuse an idempotency key; household membership cannot be spoofed with payload ids', async t => {
  const h = setup(); t.after(() => h.db.close()); await family(h);
  const requestId = randomUUID();
  await h.command(A, { type: 'private.create', text: SECRET_A, route: 'reflect' }, requestId);
  await assert.rejects(h.command(A, { type: 'private.create', text: '새로운 입력', route: 'reflect' }, requestId), status(409));
  await assert.rejects(h.command(A, { type: 'schedule.create', title: '불법 외부 구성원 포함', start: '2028-01-05T09:00:00.000Z', end: '2028-01-05T10:00:00.000Z', participantIds: [A.id, C.id] }), status(403, 422));
});
