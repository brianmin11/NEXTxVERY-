import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createEngine, createRunner, compileChangePlan } from '../src/index.js';
import { ScriptedAdapter } from '../src/adapters/scripted.js';
import { agreement, jointContext, options, hasCode, sharedPrior } from './fixtures.js';
test('server-generated agreement identity is constrained in the actual provider output schema',async()=>{
 const expected=randomUUID(),value={...agreement(),id:randomUUID()};
 const adapter=new ScriptedAdapter([value]);
 await assert.rejects(createEngine(createRunner(adapter)).propose(jointContext(),{id:expected,revision:1},{...options,maxRetries:0}),hasCode('SCHEMA_INVALID'));
 assert.equal(adapter.requests[0]!.schema.safeParse({...value,id:expected}).success,true);
 assert.equal(adapter.requests[0]!.schema.safeParse(value).success,false);
});
test('revision output cannot change identity or reuse the prior version',async()=>{
 const prior={...agreement(),id:randomUUID()};const adapter=new ScriptedAdapter([{...prior,revision:1}]);
 await assert.rejects(createEngine(createRunner(adapter)).revise(jointContext(),sharedPrior(prior),{actorId:'child',instruction:'내용을 더 명확히 해 주세요.',action:'revise'},{...options,maxRetries:0}),hasCode('SCHEMA_INVALID'));
 assert.equal(adapter.requests[0]!.schema.safeParse({...prior,revision:2}).success,true);
});
test('normalizing natural-language times never becomes literal evidence without confirmation',()=>{
 const c=jointContext();c.cards[0]!.exactText='11월 5일 19시부터 20시까지 쉬고 싶어요.';
 const a=agreement();a.actions[0]!.evidence=[{sourceId:c.cards[0]!.id,revision:c.cards[0]!.revision,quote:c.cards[0]!.exactText}];
 assert.throws(()=>compileChangePlan(a,c),hasCode('SEMANTIC_INVALID'));
 a.actions[0]!.basis='proposed';a.actions[0]!.unresolvedFields=['start','end'];
 const draft=compileChangePlan(a,c);assert.equal(draft.executable,false);assert.ok(draft.blockers.some(s=>s.includes('PROPOSED_TERMS_REQUIRE_CONFIRMATION')));
});
