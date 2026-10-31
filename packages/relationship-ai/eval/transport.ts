import {createHash} from 'node:crypto';
export interface TransportDiagnostic {at:string;method:string;origin:string;path:string;credentialMatchesExpected:boolean;organizationHeaderPresent:boolean;projectHeaderPresent:boolean;payloadSha256:string|null;status:number|null;requestId:string|null;errorType:string|null;errorCode:string|null;missingScopes:string[];latencyMs:number}
const identifier=(value:unknown,key:string)=>typeof value==='string'&&value!==key&&!value.includes(key)&&!/^sk-/i.test(value)&&/^[A-Za-z0-9_.-]{1,128}$/.test(value)?value:null;
/** Evaluation-only allowlist: never retain credentials, raw headers, input/output text or error messages. */
export function diagnosticTransport(expectedKey:string,onDiagnostic:(record:TransportDiagnostic)=>void,transport:typeof fetch=globalThis.fetch):typeof fetch {
 return async (input,init)=>{
  const request=new Request(input,init);const url=new URL(request.url);const start=Date.now();
  const record:TransportDiagnostic={at:new Date().toISOString(),method:request.method,origin:url.origin,path:url.pathname,credentialMatchesExpected:request.headers.get('authorization')===`Bearer ${expectedKey}`,organizationHeaderPresent:request.headers.has('openai-organization'),projectHeaderPresent:request.headers.has('openai-project'),payloadSha256:request.method==='POST'?createHash('sha256').update(await request.clone().text()).digest('hex'):null,status:null,requestId:null,errorType:null,errorCode:null,missingScopes:[],latencyMs:0};
  try{
   const response=await transport(request);record.status=response.status;record.requestId=identifier(response.headers.get('x-request-id'),expectedKey);
   if(!response.ok){try{const body=await response.clone().json() as {error?:{type?:unknown;code?:unknown;message?:unknown}};record.errorType=identifier(body.error?.type,expectedKey);record.errorCode=identifier(body.error?.code,expectedKey);if(typeof body.error?.message==='string')record.missingScopes=[...new Set([...body.error.message.matchAll(/\b(?:api|model)\.(?:[a-z][a-z_]*\.)*(?:read|write|request)\b/g)].map(x=>x[0]))];}catch{/* No raw body retained. */}}
   return response;
  }finally{record.latencyMs=Date.now()-start;try{onDiagnostic(record);}catch{/* Diagnostic failure must not alter API result. */}}
 };
}
