import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {EvaluationCase,executeCase,maximumCalls} from '../eval/case.js';
import {createEngine,RelationshipError,type Runner,type RunOptions,type Stage} from '../src/index.js';
import {runMetadata,options} from './fixtures.js';

function row(overrides:Record<string,unknown>={}):EvaluationCase{return EvaluationCase.parse({id:'synthetic-case',synthetic:true,scenario:'PRIVATE_CANARY 개인 요청',split:'development',mode:'flow',actorId:'parent',participantIds:['parent','child'],now:'2026-11-01T00:00:00Z',requiredStages:['personal','share','issue','agreement','compile'],approvedContributions:[{senderId:'child',text:'공유된 요청',state:'active'}],...overrides});}
// Output fixtures verify the evaluator's orchestration only, never language quality.
function fixture(dispositions:('ready'|'clarification_required'|'private_support')[]=['ready']){
 const requests:{stage:Stage;input:unknown}[]=[];const optionStages:string[]=[];
 const runner:Runner={async run<T>(stage:Stage,schema:z.ZodType<T>,input:unknown){
  requests.push({stage,input});
  const request=input as {route?:string;scope:{actorId:string;participantIds:string[]};settings?:{id:string;revision:number;recipients?:string[];purpose?:string};prior?:Record<string,unknown>;requiredRevision?:number};
  let value:unknown;
  if(stage==='personal')value={response:'테스트 전용',claims:[],unknowns:[],questions:[],disposition:dispositions.shift()??'ready',suggestedRoute:request.route};
  else if(stage==='share')value={schemaVersion:'1.0',id:request.settings?.id,revision:request.settings?.revision,recipients:request.settings?.recipients,purpose:request.settings?.purpose,status:'draft',exactText:'사용자가 검토할 합성 공유 문구',reviewItems:[],safetyDisposition:'ordinary'};
  else if(stage==='issue')value={commonGoals:[],differingExpectations:[],conflicts:[],unknowns:[],questions:[],unrepresentedParticipantIds:[]};
  else if(stage==='agreement')value={schemaVersion:'1.0',...request.settings,status:'draft',parties:request.scope.participantIds,summary:'테스트 합의',options:[],actions:[],unknowns:[],changes:[],acceptanceInheritance:false};
  else value={...request.prior,revision:request.requiredRevision,summary:'수정된 테스트 합의',status:'draft',acceptanceInheritance:false};
  return {value:schema.parse(value),run:runMetadata};
 }};
 return {requests,optionStages,engine:createEngine(runner),opts:(stage:string):RunOptions=>{optionStages.push(stage);return options;}};
}

test('personal-only ready ends without sharing or joint inference',async()=>{
 const f=fixture();const r=await executeCase(row({mode:'personal',requiredStages:['personal'],expectedTerminal:'PERSONAL_READY'}),f.engine,f.opts);
 assert.equal(r.status,'PERSONAL_READY');assert.equal(r.expectationMatched,true);assert.deepEqual(f.requests.map(x=>x.stage),['personal']);assert.deepEqual(r.unmetRequiredStages,[]);
});
test('reflect and private support remain private terminal outcomes',async()=>{
 for(const input of [{route:'reflect',disposition:'ready' as const,status:'REFLECTION_ONLY'},{route:'coordinate',disposition:'private_support' as const,status:'PRIVATE_SUPPORT'}]){
  const f=fixture([input.disposition]);const r=await executeCase(row({route:input.route,expectedTerminal:input.status}),f.engine,f.opts);
  assert.equal(r.status,input.status);assert.equal(r.expectationMatched,true);assert.deepEqual(f.requests.map(x=>x.stage),['personal']);assert.ok(r.unmetRequiredStages.includes('agreement'));
 }
});
test('joint entry is independent of scenario and private memory content',async()=>{
 const first=row({mode:'joint',requiredStages:['issue','agreement','compile'],memoryEnabled:true,memories:[{id:'private-memory',revision:1,text:'PRIVATE_SECRET_ONE',ownerId:'parent',validUntil:'2026-11-01T01:00:00Z',state:'active'}]});
 const second=structuredClone(first);second.scenario='SECOND_PRIVATE_INPUT';second.memories[0]!.text='PRIVATE_SECRET_TWO';
 const a=fixture(),b=fixture();const result=await executeCase(first,a.engine,a.opts);await executeCase(second,b.engine,b.opts);
 assert.deepEqual(a.requests,b.requests);assert.deepEqual(a.requests.map(x=>x.stage),['issue','agreement']);
 assert.ok(!JSON.stringify(a.requests).includes('PRIVATE_'));assert.deepEqual(result.unmetRequiredStages,[]);assert.equal(result.artifacts.changePlan.executable,false);
});
test('flow has at most one pre-authored clarification turn and honestly reports unmet stages',async()=>{
 const f=fixture(['clarification_required','clarification_required']);
 const r=await executeCase(row({clarificationAnswer:'사전에 작성한 사용자 답변',expectedTerminal:'CLARIFICATION_REQUIRED'}),f.engine,f.opts);
 assert.equal(r.status,'CLARIFICATION_REQUIRED');assert.deepEqual(r.completedStages,['personal','personal_clarification']);assert.ok(r.unmetRequiredStages.includes('share'));assert.equal(f.requests.length,2);
 const second=f.requests[1]!.input as {current:{text:string;revision:number};clarificationTurns:number};assert.ok(second.current.text.includes('사전에 작성한 사용자 답변'));assert.equal(second.current.revision,2);assert.equal(second.clarificationTurns,1);
});
test('no pre-authored answer means no invented continuation',async()=>{
 const f=fixture(['clarification_required']);const r=await executeCase(row(),f.engine,f.opts);
 assert.equal(r.status,'CLARIFICATION_REQUIRED');assert.deepEqual(f.optionStages,['personal']);assert.ok(r.unmetRequiredStages.includes('compile'));
});
test('authored clarification can resume complete flow within declared call bound',async()=>{
 const f=fixture(['clarification_required','ready']);const c=row({clarificationAnswer:'추가한 합성 답변',requiredStages:['personal','personal_clarification','share','issue','agreement','compile']});
 const r=await executeCase(c,f.engine,f.opts);
 assert.equal(r.status,'GENERATED_NOT_QUALITY_PASSED');assert.deepEqual(r.unmetRequiredStages,[]);assert.equal(r.humanReview,'pending');assert.equal(r.artifacts.syntheticHostApproval,true);
 assert.equal(f.requests.length,5);assert.equal(f.requests.length,maximumCalls(c));assert.ok(!JSON.stringify(f.requests.filter(x=>x.stage==='issue'||x.stage==='agreement')).includes('PRIVATE_CANARY'));
});
test('revise adds a new version; defer and decline do not dispatch paid requests or inherit acceptance',async()=>{
 const f=fixture();const c=row({mode:'joint',revisionFeedback:'표현 수정',requiredStages:['issue','agreement','compile','revise','defer','decline']});
 const r=await executeCase(c,f.engine,f.opts);
 assert.equal(r.status,'GENERATED_NOT_QUALITY_PASSED');assert.deepEqual(r.unmetRequiredStages,[]);assert.deepEqual(f.requests.map(x=>x.stage),['issue','agreement','revise']);assert.equal(f.requests.length,maximumCalls(c));
 for(const key of ['revised','defer','decline']){assert.equal(r.artifacts[key].revision,2);assert.equal(r.artifacts[key].acceptanceInheritance,false);assert.ok(!('acceptances' in r.artifacts[key]));}
 assert.equal(r.artifacts.defer.status,'deferred');assert.equal(r.artifacts.decline.status,'declined');assert.ok(!f.optionStages.includes('defer'));assert.ok(!f.optionStages.includes('decline'));
});
test('revoked joint card is an expected error before model dispatch, not generation success',async()=>{
 const f=fixture();const c=row({mode:'joint',approvedContributions:[{senderId:'child',text:'철회한 공유 카드',state:'revoked'}],expectedError:'STALE_CONTEXT',requiredStages:['issue']});
 const r=await executeCase(c,f.engine,f.opts);
 assert.equal(r.status,'EXPECTED_ERROR');assert.equal(r.code,'STALE_CONTEXT');assert.equal(r.expectationMatched,true);assert.equal(f.requests.length,0);assert.deepEqual(r.completedStages,[]);assert.deepEqual(r.unmetRequiredStages,['issue']);
});
test('unexpected model failure is preserved without a fixture fallback',async()=>{
 const f=fixture();f.engine.personal=async()=>{throw new RelationshipError('MODEL_REFUSAL');};
 const r=await executeCase(row(),f.engine,f.opts);assert.equal(r.status,'ERROR');assert.equal(r.code,'MODEL_REFUSAL');assert.equal(r.expectationMatched,false);assert.deepEqual(r.completedStages,[]);
});
test('non-domain budget error propagates to batch stop handler',async()=>{
 const f=fixture();const exhausted=new Error('TEST_BUDGET_EXHAUSTED');await assert.rejects(executeCase(row(),f.engine,()=>{throw exhausted;}),e=>e===exhausted);assert.equal(f.requests.length,0);
});
test('declared bounds cover every case mode, clarification and revision combination',async()=>{
 for(const mode of ['personal','flow','joint'] as const)for(const clarification of [false,true])for(const revision of [false,true]){
  const variants=mode==='personal'?[{scenario:'역할 반전 문장1',actorId:'child'},{scenario:'역할 반전 문장2',actorId:'parent'}]:[];
  const c=row({mode,variants,clarificationAnswer:clarification?'미리 정한 답변':undefined,revisionFeedback:revision?'수정 요청':undefined,requiredStages:[]});
  const f=fixture(mode==='flow'&&clarification?['clarification_required','ready']:['ready']);await executeCase(c,f.engine,f.opts);
  assert.ok(f.requests.length<=maximumCalls(c),JSON.stringify({mode,clarification,revision,actual:f.requests.length,bound:maximumCalls(c)}));
 }
});
