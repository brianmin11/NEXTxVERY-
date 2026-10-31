import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { createRunner } from '../src/runtime.js';
import { RelationshipError, type ModelAdapter, type ModelRequest, type ModelReply, type ModelRunMetadata } from '../src/contracts/index.js';
import { hasCode, options } from './fixtures.js';
const schema=z.strictObject({message:z.string()});
function adapter(fn:(r:ModelRequest)=>Promise<ModelReply>):ModelAdapter{return {name:'test-only',model:'test-only',generate:fn};}
const ok=()=>Promise.resolve({value:{message:'테스트'},model:'test-only',inputTokens:20,outputTokens:10});
test('runtime returns validated data and measured metadata without input text',async()=>{
 const logs:ModelRunMetadata[]=[];const out=await createRunner(adapter(ok)).run('personal',schema,{text:'비공개 비취 432'},{...options,onMetadata:(m:ModelRunMetadata)=>logs.push(m)});
 assert.equal(out.value.message,'테스트');assert.equal(out.run.calls,1);assert.equal(out.run.inputTokens,20);assert.equal(out.run.outputTokens,10);
 assert.ok(!JSON.stringify(logs).includes('비취 432'));
});
test('malformed model output is an error, never a mock success',async()=>{
 await assert.rejects(createRunner(adapter(async()=>({value:{wrong:true},model:'test-only',inputTokens:20,outputTokens:10}))).run('personal',schema,{},options),hasCode('SCHEMA_INVALID'));
});
test('pre-cancelled request invokes no model',async()=>{
 let calls=0;const c=new AbortController();c.abort();
 await assert.rejects(createRunner(adapter(async()=>{calls++;return ok();})).run('personal',schema,{},{...options,signal:c.signal}),hasCode('CANCELLED'));assert.equal(calls,0);
});
test('in-flight cancellation terminates even an uncooperative adapter',async()=>{
 const c=new AbortController();const timer=setTimeout(()=>c.abort(),15);
 try{await assert.rejects(createRunner(adapter(()=>new Promise(()=>{}))).run('personal',schema,{},{...options,signal:c.signal,timeoutMs:200}),hasCode('CANCELLED'));}finally{clearTimeout(timer);}
});
test('timeout terminates uncooperative adapter',async()=>{
 await assert.rejects(createRunner(adapter(()=>new Promise(()=>{}))).run('personal',schema,{},{...options,timeoutMs:20}),hasCode('TIMEOUT'));
});
test('call count and retry ceiling bound rate-limit retries',async()=>{
 let calls=0;const a=adapter(async()=>{calls++;throw new RelationshipError('RATE_LIMIT',true);});
 await assert.rejects(createRunner(a).run('personal',schema,{},{...options,maxCalls:2,maxRetries:1}));assert.ok(calls<=2);assert.ok(calls>=1);
});
test('non-retryable refusal makes only one attempt',async()=>{
 let calls=0;const a=adapter(async()=>{calls++;throw new RelationshipError('MODEL_REFUSAL',false);});
 await assert.rejects(createRunner(a).run('personal',schema,{},options),hasCode('MODEL_REFUSAL'));assert.equal(calls,1);
});
test('budget denial and oversized input happen before provider call',async()=>{
 for(const changes of [{maxCostUsd:0},{maxCalls:0},{maxInputBytes:1}]){
  let calls=0;const a=adapter(async()=>{calls++;return ok();});
  await assert.rejects(createRunner(a).run('personal',schema,{text:'많은 입력'},{...options,...changes}));assert.equal(calls,0);
 }
});
test('missing token usage is unknown, not a zero-cost claim',async()=>{
 const out=await createRunner(adapter(async()=>({value:{message:'테스트'},model:'test-only',inputTokens:null,outputTokens:null}))).run('personal',schema,{},options);
 assert.equal(out.run.inputTokens,null);assert.equal(out.run.outputTokens,null);assert.equal(out.run.estimatedCostUsd,null);assert.equal(out.run.usageComplete,false);
});
test('provider exception is sanitized and is not successful data',async()=>{
 const logs:ModelRunMetadata[]=[];
 await assert.rejects(createRunner(adapter(async()=>{throw new Error('private secret API token raw error');})).run('personal',schema,{},{...options,onMetadata:(m:ModelRunMetadata)=>logs.push(m)}),(e:unknown)=>e instanceof Error&&!e.message.includes('private secret'));
 assert.ok(!JSON.stringify(logs).includes('private secret'));
});
test('known failed-response usage is metered and unknown retries remain unknown',async()=>{
 const logs:ModelRunMetadata[]=[];
 const a=adapter(async()=>{throw new RelationshipError('TRUNCATED',false,undefined,{model:'snapshot',inputTokens:41,outputTokens:500});});
 await assert.rejects(createRunner(a).run('personal',schema,{},{...options,onMetadata:m=>logs.push(m)}),hasCode('TRUNCATED'));
 assert.equal(logs[0]?.inputTokens,41);assert.equal(logs[0]?.outputTokens,500);assert.equal(logs[0]?.usageComplete,true);assert.equal(logs[0]?.model,'snapshot');
 let calls=0;const retryLogs:ModelRunMetadata[]=[];
 const b=adapter(async()=>{if(++calls===1)throw new RelationshipError('PROVIDER_ERROR',true);return ok();});
 await createRunner(b).run('personal',schema,{},{...options,maxCalls:2,maxRetries:1,onMetadata:m=>retryLogs.push(m)});
 assert.equal(retryLogs[0]?.usageComplete,false);assert.equal(retryLogs[0]?.estimatedCostUsd,null);
});
test('schema validation failure keeps observed usage without treating output as successful',async()=>{
 const logs:ModelRunMetadata[]=[];
 await assert.rejects(createRunner(adapter(async()=>({value:{wrong:true},model:'test-only',inputTokens:20,outputTokens:10}))).run('personal',schema,{},{...options,onMetadata:m=>logs.push(m)}),hasCode('SCHEMA_INVALID'));
 assert.equal(logs[0]?.inputTokens,20);assert.equal(logs[0]?.errorCode,'SCHEMA_INVALID');
});
