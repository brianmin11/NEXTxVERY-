import { z } from 'zod';
import { RelationshipError, VERSION, type ModelAdapter, type ModelRunMetadata, type RunOptions, type Runner, type Stage } from './contracts/index.js';
import { POLICY_VERSION, PROMPT_VERSION, prompts } from './prompts/index.js';
const limits=z.object({maxCalls:z.number().int().min(1).max(10),maxRetries:z.number().int().min(0).max(3),maxInputBytes:z.number().int().positive().max(1000000),maxOutputTokens:z.number().int().min(1).max(16000),timeoutMs:z.number().int().positive().max(180000),maxCostUsd:z.number().finite().nonnegative(),price:z.object({version:z.string().min(1),inputPerMillion:z.number().finite().nonnegative(),outputPerMillion:z.number().finite().nonnegative()}).optional()});
export function createRunner(adapter:ModelAdapter):Runner {
 return {async run<T>(stage:Stage,schema:z.ZodType<T>,input:unknown,options:RunOptions){
  if(!limits.safeParse(options).success)throw new RelationshipError('INPUT_INVALID');
  const started=Date.now(); let calls=0, inputTokens=0, outputTokens=0, usageComplete=true, spentUpper=0;
  let errorCode:ModelRunMetadata['errorCode']=null;
  const metadata=():ModelRunMetadata=>({adapter:adapter.name,model:adapter.model,promptVersion:PROMPT_VERSION,policyVersion:POLICY_VERSION,schemaVersion:VERSION,calls,retries:Math.max(0,calls-1),latencyMs:Date.now()-started,inputTokens:usageComplete?inputTokens:null,outputTokens:usageComplete?outputTokens:null,estimatedCostUsd:usageComplete&&options.price?(inputTokens*options.price.inputPerMillion+outputTokens*options.price.outputPerMillion)/1e6:null,priceVersion:options.price?.version??null,usageComplete,errorCode});
  const controller=new AbortController(); let expired=false;
  const cancel=()=>controller.abort(); options.signal?.addEventListener('abort',cancel,{once:true});
  const timer=setTimeout(()=>{expired=true;controller.abort();},options.timeoutMs);
  try {
   if(options.signal?.aborted)throw new RelationshipError('CANCELLED');
   let serialized:string;try {serialized=JSON.stringify({system:prompts[stage],input,schema:z.toJSONSchema(schema)});}catch{throw new RelationshipError('INPUT_INVALID');}
   const bytes=Buffer.byteLength(serialized,'utf8');
   if(bytes>options.maxInputBytes)throw new RelationshipError('BUDGET_EXCEEDED');
   // UTF-8 bytes plus framing reserve is a conservative estimate, NOT measured tokens.
   if(!options.price)throw new RelationshipError('BUDGET_EXCEEDED');
   const upper=((bytes+2048)*options.price.inputPerMillion+options.maxOutputTokens*options.price.outputPerMillion)/1e6;
   while(true){
    if(controller.signal.aborted)throw new RelationshipError(expired?'TIMEOUT':'CANCELLED');
    if(calls>=options.maxCalls||spentUpper+upper>options.maxCostUsd)throw new RelationshipError('BUDGET_EXCEEDED');
    calls++;spentUpper+=upper;
    let abortHandler:(()=>void)|undefined;
    try {
     const aborted=new Promise<never>((_,reject)=>{abortHandler=()=>reject(new RelationshipError(expired?'TIMEOUT':'CANCELLED'));controller.signal.addEventListener('abort',abortHandler,{once:true});});
     const reply=await Promise.race([adapter.generate({stage,system:prompts[stage],input,schema,maxOutputTokens:options.maxOutputTokens,signal:controller.signal}),aborted]);
     if(reply.inputTokens===null||reply.outputTokens===null)usageComplete=false;
     else if(!Number.isFinite(reply.inputTokens)||!Number.isFinite(reply.outputTokens)||reply.inputTokens<0||reply.outputTokens<0){usageComplete=false;throw new RelationshipError('PROVIDER_ERROR');}
     else {inputTokens+=reply.inputTokens;outputTokens+=reply.outputTokens;}
     const parsed=schema.safeParse(reply.value);
     if(!parsed.success)throw new RelationshipError('SCHEMA_INVALID');
     if(reply.outputTokens!==null&&reply.outputTokens>options.maxOutputTokens)throw new RelationshipError('BUDGET_EXCEEDED');
     const actual=metadata().estimatedCostUsd;
     if(actual!==null&&actual>options.maxCostUsd)throw new RelationshipError('BUDGET_EXCEEDED');
     return {value:parsed.data,run:metadata()};
    } catch(e){
     const err=e instanceof RelationshipError?e:new RelationshipError('PROVIDER_ERROR',true);
     // On failed attempts the provider may have billed tokens we cannot observe.
     usageComplete=false;
     if(!err.retryable||calls>options.maxRetries||calls>=options.maxCalls||controller.signal.aborted)throw err;
    } finally {if(abortHandler)controller.signal.removeEventListener('abort',abortHandler);}
   }
  } catch(e){const err=e instanceof RelationshipError?e:new RelationshipError('PROVIDER_ERROR');errorCode=err.code;throw err;}
  finally{clearTimeout(timer);options.signal?.removeEventListener('abort',cancel);try{options.onMetadata?.(metadata());}catch{/* Telemetry failure must not alter outcome or expose request contents. */}}
 }};
}
