import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {zodTextFormat} from 'openai/helpers/zod';
import {OpenAIAdapter} from '../src/adapters/openai.js';
import {PersonalResult,ShareCardDraft,IssueAnalysis,AgreementDraft,type ModelRequest} from '../src/contracts/index.js';
const req:ModelRequest={stage:'personal',system:'policy',input:{current:'synthetic'},schema:z.strictObject({message:z.string()}),maxOutputTokens:500,signal:new AbortController().signal};
function transport(body:unknown,status=200,observe?:(body:any)=>void):typeof fetch{return async (_url,init)=>{if(init?.body)observe?.(JSON.parse(String(init.body)));return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});};}
test('SDK serializes strict schema without stored state, tools or SDK retries',async()=>{
 let captured:any;
 const a=new OpenAIAdapter('test-model','TEST_ONLY_NOT_A_KEY',transport({id:'resp_test',object:'response',created_at:0,status:'completed',model:'test-model',output:[{type:'message',id:'m',role:'assistant',status:'completed',content:[{type:'output_text',text:'{"message":"합성"}',annotations:[]}]}],usage:{input_tokens:10,output_tokens:5,total_tokens:15}},200,b=>captured=b));
 const result=await a.generate(req);assert.deepEqual(result.value,{message:'합성'});assert.equal(result.inputTokens,10);assert.equal(captured.store,false);assert.equal(captured.text.format.strict,true);assert.ok(!captured.tools);assert.equal(captured.max_output_tokens,500);
});
for(const [body,code] of [[{status:'incomplete',output:[]},'TRUNCATED'],[{status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'No'}]}]},'MODEL_REFUSAL'],[{status:'completed',output:[{type:'message',content:[{type:'output_text',text:'broken'}]}]},'SCHEMA_INVALID']] as const)test('SDK maps '+code+' without fixture fallback',async()=>{
 await assert.rejects(new OpenAIAdapter('test','TEST_ONLY',transport(body)).generate(req),(e:any)=>e.code===code);
});
test('SDK rate limit performs one attempt and marks retryable',async()=>{
 let calls=0;const a=new OpenAIAdapter('test','TEST_ONLY',async()=>{calls++;return new Response(JSON.stringify({error:{message:'synthetic'}}),{status:429,headers:{'content-type':'application/json'}});});
 await assert.rejects(a.generate(req),(e:any)=>e.code==='RATE_LIMIT'&&e.retryable);assert.equal(calls,1);
});
test('every stage output can become an OpenAI strict JSON schema locally',()=>{
 for(const schema of [PersonalResult,ShareCardDraft.extend({safetyDisposition:z.enum(['ordinary','private_support'])}),IssueAnalysis,AgreementDraft]){const format=zodTextFormat(schema,'test');assert.equal(format.strict,true);assert.ok(format.schema);}
});
test('permission diagnostics expose only status and scope names, never raw error or credentials',async()=>{
 const a=new OpenAIAdapter('test','TEST_ONLY',transport({error:{message:'Missing scopes: api.responses.write. private-text secret-token'}},403));
 await assert.rejects(a.generate(req),(e:any)=>{assert.deepEqual(e.providerDetails,{status:403,missingScopes:['api.responses.write']});assert.ok(!JSON.stringify(e).includes('secret-token'));return e.code==='POLICY_RESTRICTED';});
});
test('provider-observed usage survives truncation without retaining response text',async()=>{
 const a=new OpenAIAdapter('test','TEST_ONLY',transport({status:'incomplete',model:'test-snapshot',output:[],usage:{input_tokens:41,output_tokens:500,total_tokens:541}}));
 await assert.rejects(a.generate(req),(e:any)=>{assert.deepEqual(e.providerUsage,{model:'test-snapshot',inputTokens:41,outputTokens:500});return e.code==='TRUNCATED';});
});
