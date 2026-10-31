import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { RelationshipError, type ModelAdapter, type ModelRequest, type ModelReply } from '../contracts/index.js';
export class OpenAIAdapter implements ModelAdapter {
 readonly name='openai-responses'; private client:OpenAI;
 constructor(readonly model:string,apiKey:string, transport?: typeof globalThis.fetch){if(!model||!apiKey)throw new RelationshipError('INPUT_INVALID');this.client=new OpenAI({apiKey,maxRetries:0,...(transport?{fetch:transport}:{})});}
 async generate(req:ModelRequest):Promise<ModelReply>{
  try {
   // No SDK auto-retry, state, tools, stored conversation, or fixture fallback.
   const response=await this.client.responses.create({model:this.model,store:false,instructions:req.system,input:JSON.stringify(req.input),max_output_tokens:req.maxOutputTokens,text:{format:zodTextFormat(req.schema,req.stage)}},{signal:req.signal});
   if(response.status==='incomplete')throw new RelationshipError('TRUNCATED');
   if(response.output.some(o=>o.type==='message'&&o.content.some(c=>c.type==='refusal')))throw new RelationshipError('MODEL_REFUSAL');
   if(response.status!=='completed')throw new RelationshipError('PROVIDER_ERROR');
   let value:unknown;try{value=JSON.parse(response.output_text);}catch{throw new RelationshipError('SCHEMA_INVALID');}
   return {value,model:response.model,inputTokens:response.usage?.input_tokens??null,outputTokens:response.usage?.output_tokens??null};
  }catch(e){
   if(e instanceof RelationshipError)throw e;
   if(req.signal.aborted)throw new RelationshipError('CANCELLED');
   if(e instanceof OpenAI.APIError){if(e.status===429)throw new RelationshipError('RATE_LIMIT',true);if(e.status===401||e.status===403){const missingScopes=[...e.message.matchAll(/\b(?:api|model)\.[a-z][a-z_.]*(?:read|write|request)\b/g)].map(x=>x[0]);throw new RelationshipError('POLICY_RESTRICTED',false,{status:e.status,missingScopes:[...new Set(missingScopes)]});}if(e.status===400)throw new RelationshipError('INPUT_INVALID');throw new RelationshipError('PROVIDER_ERROR',(e.status??0)>=500);}
   throw new RelationshipError('PROVIDER_ERROR',true);
  }
 }
 async checkAccess():Promise<{model:string;accessible:boolean}>{try{await this.client.models.retrieve(this.model);return {model:this.model,accessible:true};}catch{ return {model:this.model,accessible:false};}}
}
