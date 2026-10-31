import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {diagnosticTransport,type TransportDiagnostic} from '../eval/transport.js';
const key='sk-TEST-ONLY-secret-983';const secret='PRIVATE_PAYLOAD_CANARY';
function request(){return new Request('https://api.openai.com/v1/responses?opaque=query-secret',{method:'POST',headers:{authorization:'Bearer '+key,'content-type':'application/json','openai-organization':'org-private','openai-project':'project-private','x-custom':'preserve-me'},body:JSON.stringify({input:secret,model:'test-only'})});}

test('diagnostic wrapper preserves actual request headers and body but logs no credentials or payload',async()=>{
 const records:TransportDiagnostic[]=[];const original=request();let dispatched:Request|undefined;
 const transport:typeof fetch=async(input,init)=>{dispatched=new Request(input,init);return new Response(JSON.stringify({output:'PRIVATE_OUTPUT_CANARY'}),{status:200,headers:{'x-request-id':'req-123'}});};
 const response=await diagnosticTransport(key,r=>records.push(r),transport)(original);
 assert.equal(dispatched!.headers.get('authorization'),'Bearer '+key);assert.equal(dispatched!.headers.get('openai-organization'),'org-private');assert.equal(dispatched!.headers.get('openai-project'),'project-private');assert.equal(dispatched!.headers.get('x-custom'),'preserve-me');assert.deepEqual(await dispatched!.json(),{input:secret,model:'test-only'});
 assert.deepEqual(await response.json(),{output:'PRIVATE_OUTPUT_CANARY'});assert.equal(records.length,1);
 const record=records[0]!;assert.equal(record.credentialMatchesExpected,true);assert.equal(record.organizationHeaderPresent,true);assert.equal(record.projectHeaderPresent,true);assert.equal(record.path,'/v1/responses');assert.equal(record.requestId,'req-123');assert.equal(record.status,200);
 assert.equal(record.payloadSha256,createHash('sha256').update(JSON.stringify({input:secret,model:'test-only'})).digest('hex'));
 const log=JSON.stringify(records);for(const value of [key,secret,'PRIVATE_OUTPUT_CANARY','org-private','project-private','query-secret'])assert.ok(!log.includes(value),value);
});
test('401 keeps original response but diagnostic includes only sanitized status, identifiers and scope names',async()=>{
 const records:TransportDiagnostic[]=[];const raw={error:{type:'invalid_request_error',code:'invalid_api_key',message:`RAW_SECRET ${key} ${secret} missing api.responses.write api.responses.write model.request`}};
 const transport:typeof fetch=async()=>new Response(JSON.stringify(raw),{status:401,headers:{'x-request-id':'req-401'}});
 const response=await diagnosticTransport(key,r=>records.push(r),transport)(request());assert.deepEqual(await response.json(),raw);
 assert.equal(records[0]!.status,401);assert.equal(records[0]!.errorCode,'invalid_api_key');assert.equal(records[0]!.errorType,'invalid_request_error');assert.deepEqual(records[0]!.missingScopes,['api.responses.write','model.request']);
 const logged=JSON.stringify(records);for(const value of [key,secret,'RAW_SECRET',raw.error.message])assert.ok(!logged.includes(value));
});
test('mismatching expected credential is a boolean observation, never a rewritten authorization',async()=>{
 const records:TransportDiagnostic[]=[];let sent='';const transport:typeof fetch=async(input,init)=>{sent=new Request(input,init).headers.get('authorization')??'';return new Response('{}');};
 await diagnosticTransport('another-test-key',r=>records.push(r),transport)(request());assert.equal(sent,'Bearer '+key);assert.equal(records[0]!.credentialMatchesExpected,false);assert.ok(!JSON.stringify(records).includes(key));
});
test('observer failure cannot replace a successful provider response or create another dispatch',async()=>{
 let dispatched=0;const transport:typeof fetch=async()=>{dispatched++;return new Response('original',{status:200});};
 const response=await diagnosticTransport(key,()=>{throw new Error('observer failed');},transport)(request());assert.equal(await response.text(),'original');assert.equal(dispatched,1);
});
test('transport rejection is preserved and observer receives no raw exception text',async()=>{
 const failure=new Error('NETWORK_EXCEPTION '+key+' '+secret);const records:TransportDiagnostic[]=[];let dispatched=0;const transport:typeof fetch=async()=>{dispatched++;throw failure;};
 await assert.rejects(diagnosticTransport(key,r=>records.push(r),transport)(request()),e=>e===failure);assert.equal(dispatched,1);assert.equal(records.length,1);assert.equal(records[0]!.status,null);assert.equal(records[0]!.errorCode,null);assert.ok(!JSON.stringify(records).includes('NETWORK_EXCEPTION'));assert.ok(!JSON.stringify(records).includes(key));
});
test('non-JSON error bodies stay readable and are not captured',async()=>{
 const records:TransportDiagnostic[]=[];const transport:typeof fetch=async()=>new Response('PRIVATE_PROXY_ERROR '+secret,{status:502});
 const response=await diagnosticTransport(key,r=>records.push(r),transport)(request());assert.equal(await response.text(),'PRIVATE_PROXY_ERROR '+secret);assert.equal(records[0]!.status,502);assert.equal(records[0]!.errorType,null);assert.ok(!JSON.stringify(records).includes(secret));
});
test('malformed identifier fields are omitted rather than copied as raw errors',async()=>{
 const records:TransportDiagnostic[]=[];const transport:typeof fetch=async()=>new Response(JSON.stringify({error:{type:'private error with spaces',code:{secret},message:'private text'}}),{status:400,headers:{'x-request-id':'private header value'}});
 await diagnosticTransport(key,r=>records.push(r),transport)(request());assert.equal(records[0]!.errorType,null);assert.equal(records[0]!.errorCode,null);assert.equal(records[0]!.requestId,null);assert.ok(!JSON.stringify(records).includes('private error'));
});
test('GET diagnostics do not invent a payload hash or mutate method',async()=>{
 const records:TransportDiagnostic[]=[];const transport:typeof fetch=async input=>{assert.equal((input as Request).method,'GET');return new Response('{}');};
 await diagnosticTransport(key,r=>records.push(r),transport)('https://api.openai.com/v1/models');assert.equal(records[0]!.payloadSha256,null);assert.equal(records[0]!.method,'GET');assert.equal(records[0]!.credentialMatchesExpected,false);
});
test('credential-shaped values are never logged even when returned in identifier fields',async()=>{
 const records:TransportDiagnostic[]=[];const transport:typeof fetch=async()=>new Response(JSON.stringify({error:{type:key,code:key,message:'denied'}}),{status:401,headers:{'x-request-id':key}});
 await diagnosticTransport(key,r=>records.push(r),transport)(request());assert.ok(!JSON.stringify(records).includes(key));
});
