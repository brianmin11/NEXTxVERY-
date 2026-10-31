import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../src/lib/server/engine.js';
import { compileChangePlan, verifyAcceptanceVersion } from '../src/lib/server/compile.js';
import { agreement, hasCode, issue, jointContext, options, personalResult, privateContext, stub } from './fixtures.js';

test('memory disabled excludes stored history but preserves current request', async()=>{
 const c=privateContext();c.memoryEnabled=false;
 const s=stub([personalResult()]);const result=await createEngine(s.runner).personal(c,options);
 const sent=JSON.stringify(s.inputs);
 assert.ok(sent.includes('오늘은 쉬고 싶어요'));
 assert.ok(!sent.includes('비취 432'));
 assert.ok(!sent.includes('memory-private'));
 assert.deepEqual(result.metadata.sourceVersions,[{id:'current-private',revision:1}]);
});
test('changing stored history while memory disabled cannot change model input',async()=>{
 const first=privateContext();first.memoryEnabled=false;
 const second=structuredClone(first);second.memories[0]!.text='전혀 다른 개인 정보';
 const a=stub([personalResult()]),b=stub([personalResult()]);
 await createEngine(a.runner).personal(first,options);await createEngine(b.runner).personal(second,options);
 assert.deepEqual(a.inputs,b.inputs);
});
test('invalid current ownership is rejected before model call',async()=>{
 const c=privateContext();c.current.ownerId='parent';const s=stub([]);
 await assert.rejects(createEngine(s.runner).personal(c,options));assert.equal(s.inputs.length,0);
});
for(const state of ['revoked','deleted','corrected'] as const)test('invalid current state '+state+' fails closed',async()=>{
 const c=privateContext();c.current.state=state;const s=stub([]);
 await assert.rejects(createEngine(s.runner).personal(c,options));assert.equal(s.inputs.length,0);
});
test('expired current input is not used',async()=>{
 const c=privateContext();c.current.validUntil='2026-10-31T00:00:00+09:00';const s=stub([]);
 await assert.rejects(createEngine(s.runner).personal(c,options),hasCode('STALE_CONTEXT'));assert.equal(s.inputs.length,0);
});
test('source id, version and quoted text must all match allowed evidence',async()=>{
 for(const patch of [{sourceId:'unknown'},{revision:99},{quote:'없는 발언'}]){
  const result=personalResult();Object.assign(result.claims[0]!.evidence[0]!,patch);
  await assert.rejects(createEngine(stub([result]).runner).personal(privateContext(),options),hasCode('SEMANTIC_INVALID'));
 }
});
test('speaker cannot be changed to another family member by model',async()=>{
 const result=personalResult();result.claims[0]!.speakerId='parent';
 await assert.rejects(createEngine(stub([result]).runner).personal(privateContext(),options),hasCode('SEMANTIC_INVALID'));
});
test('clarification limit does not create an endless question loop',async()=>{
 const c=privateContext();c.clarificationTurns=2;const r=personalResult();r.questions=['언제 쉬고 싶나요?'];r.unknowns=['시간'];r.disposition='clarification_required';
 const out=await createEngine(stub([r]).runner).personal(c,options);
 assert.equal(out.value.questions.length,0);assert.ok(out.value.unknowns.length>0);
});
test('joint input rejects extra private context fields before calling model',async()=>{
 const s=stub([]);const c={...jointContext(),privateContext:privateContext()};
 await assert.rejects(createEngine(s.runner).analyze(c,options),hasCode('INPUT_INVALID'));assert.equal(s.inputs.length,0);
});
test('private-only record changes cannot affect joint call or shared metadata',async()=>{
 const p=privateContext();const s=stub([issue(),issue()]);const engine=createEngine(s.runner);
 const a=await engine.analyze(jointContext(),options);p.memories[0]!.text='바뀐 비공개 이야기';
 const b=await engine.analyze(jointContext(),options);assert.deepEqual(s.inputs[0],s.inputs[1]);
 assert.deepEqual(a.metadata,b.metadata);
 assert.ok(!JSON.stringify([s.inputs,a,b]).includes('current-private'));
 assert.ok(!JSON.stringify([s.inputs,a,b]).includes('memory-private'));
 assert.equal(a.metadata.visibility,'shared');
});
for(const patch of [{state:'revoked'},{state:'deleted'},{state:'corrected'},{permissionEpoch:3},{householdId:'other'},{purpose:'other'},{hostVerified:false},{validUntil:'2026-10-01T00:00:00+09:00'},{recipients:[]}])test('invalid approved-card scope rejected: '+JSON.stringify(patch),async()=>{
 const c=jointContext();Object.assign(c.cards[0]!,patch);const s=stub([]);
 await assert.rejects(createEngine(s.runner).analyze(c,options));assert.equal(s.inputs.length,0);
});
test('shared output cannot cite private source ids',async()=>{
 const r=issue();r.differingExpectations[0]!.evidence[0]!.sourceId='memory-private';
 await assert.rejects(createEngine(stub([r]).runner).analyze(jointContext(),options),hasCode('SEMANTIC_INVALID'));
});
test('one-sided input preserves the missing participant',async()=>{
 const out=await createEngine(stub([issue()]).runner).analyze(jointContext(),options);
 assert.ok(out.value.unrepresentedParticipantIds.includes('parent'));
});
test('defer and decline preserve choice without model invocation',async()=>{
 for(const action of ['defer','decline'] as const){
  const s=stub([]);const out=await createEngine(s.runner).revise(jointContext(),agreement(),{actorId:'child',instruction:'나중에',action},options);
  assert.equal(out.value.status,action==='defer'?'deferred':'declined');
  assert.equal(out.value.acceptanceInheritance,false);assert.equal(s.inputs.length,0);
 }
});
test('revision changes version and old acceptance cannot match new semantic plan',async()=>{
 const prior=agreement();const revised=agreement();revised.revision=2;revised.summary='수정한 문구';
 const out=await createEngine(stub([revised]).runner).revise(jointContext(),prior,{actorId:'child',instruction:'문구를 수정해 주세요',action:'revise'},options);
 assert.equal(out.value.revision,2);assert.equal(out.value.acceptanceInheritance,false);assert.ok(out.value.changes.length>0);
 const before=compileChangePlan(prior,jointContext());const after=compileChangePlan(out.value,jointContext());
 assert.equal(verifyAcceptanceVersion(after,{agreementId:before.agreementId,revision:before.agreementRevision,semanticHash:before.semanticHash}),false);
});
test('valid plan remains a draft and never grants execution authority',()=>{
 const p=compileChangePlan(agreement(),jointContext());assert.equal(p.executable,false);assert.equal(p.status,'draft');assert.equal(p.requiresHostRevalidation,true);
});
test('compile is deterministic',()=>assert.deepEqual(compileChangePlan(agreement(),jointContext()),compileChangePlan(agreement(),jointContext())));
// Invalid plans may return blockers or throw validation errors; neither can be a clean executable proposal.
function blocked(a:unknown,c:unknown){try{const p=compileChangePlan(a,c);assert.ok(p.blockers.length>0);assert.equal(p.executable,false);}catch(e){if(e instanceof assert.AssertionError)throw e;assert.ok(e instanceof Error);}}
test('missing assignee remains unresolved',()=>{const a=agreement();(a.actions[0] as unknown as {assigneeId:null}).assigneeId=null;blocked(a,jointContext());});
test('unknown assignee, recipient or update target fails validation',()=>{
 for(const patch of [{assigneeId:'stranger'},{reminderRecipients:['stranger']},{kind:'schedule_update',targetId:'missing-event'}]){const a=agreement();Object.assign(a.actions[0]!,patch);blocked(a,jointContext());}
});
test('past, reversed and impossible dates cannot produce a clean change plan',()=>{
 for(const patch of [{start:'2026-10-01T19:00:00+09:00',end:'2026-10-01T20:00:00+09:00'},{end:'2026-11-05T18:00:00+09:00'},{start:'2026-02-30T19:00:00+09:00'}]){const a=agreement();Object.assign(a.actions[0]!,patch);blocked(a,jointContext());}
});
test('recurrence must have a finite end and valid weekdays',()=>{
 for(const patch of [{recurrence:'weekly',weekdays:[4],until:null},{recurrence:'weekly',weekdays:[],until:'2026-11-26T20:00:00+09:00'},{recurrence:'weekly',weekdays:[9],until:'2026-11-26T20:00:00+09:00'}]){const a=agreement();Object.assign(a.actions[0]!,patch);blocked(a,jointContext());}
});
test('shared busy schedule overlap prevents clean change plan',()=>{
 const c=jointContext();c.schedules=[{id:'busy',revision:1,participantIds:['child'],start:'2026-11-05T18:30:00+09:00',end:'2026-11-05T20:30:00+09:00',title:'기존 일정'}];blocked(agreement(),c);
});
test('unsupported timezone and explicit unresolved fields prevent clean change plan',()=>{
 const c=jointContext();c.scope.timezone='Not/AZone';blocked(agreement(),c);
 const a=agreement();a.actions[0]!.unresolvedFields=['담당자 확인'];blocked(a,jointContext());
});
test('share generation has its own safety check and never exposes unsafe draft',async()=>{
 const c=privateContext();c.route='share';
 const unsafe={schemaVersion:'1.0',id:'share',revision:1,status:'draft',exactText:'보내지 않을 문구',recipients:['parent'],purpose:'schedule',reviewItems:[],safetyDisposition:'private_support'};
 const s=stub([unsafe]);
 await assert.rejects(createEngine(s.runner).share(c,{id:'share',revision:1,recipients:['parent'],purpose:'schedule',constraintsOnly:true},options),hasCode('POLICY_RESTRICTED'));
});
test('ordinary share remains a private unapproved draft with server-controlled recipients',async()=>{
 const c=privateContext();c.route='share';
 const draft={schemaVersion:'1.0',id:'share',revision:1,status:'draft',exactText:'오늘은 쉬고 싶어요.',recipients:['parent'],purpose:'schedule',reviewItems:[],safetyDisposition:'ordinary'};
 const out=await createEngine(stub([draft]).runner).share(c,{id:'share',revision:1,recipients:['parent'],purpose:'schedule',constraintsOnly:true},options);
 assert.equal(out.value.status,'draft');assert.equal(out.metadata.visibility,'private');assert.deepEqual(out.value.recipients,['parent']);assert.ok(!('safetyDisposition' in out.value));
});
test('sourced action cannot invent a valid but unmentioned timestamp',()=>{
 const a=agreement();a.actions[0]!.start='2026-11-06T19:00:00+09:00';a.actions[0]!.end='2026-11-06T20:00:00+09:00';blocked(a,jointContext());
});
test('model cannot expand agreement to a nonparticipant',async()=>{
 const a=agreement();a.parties.push('outsider');
 await assert.rejects(createEngine(stub([a]).runner).propose(jointContext(),{id:'agreement',revision:1},options),hasCode('SEMANTIC_INVALID'));
});
test('old approval versions and semantic hashes are independently rejected',()=>{
 const plan=compileChangePlan(agreement(),jointContext());
 const base={agreementId:plan.agreementId,revision:plan.agreementRevision,semanticHash:plan.semanticHash};
 assert.equal(verifyAcceptanceVersion(plan,base),true);
 for(const patch of [{agreementId:'another'},{revision:base.revision+1},{semanticHash:'different'}])assert.equal(verifyAcceptanceVersion(plan,{...base,...patch}),false);
});
