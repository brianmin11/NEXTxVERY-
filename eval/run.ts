import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createEngine,createRunner,OpenAIAdapter,RelationshipError, type RunOptions, type ModelRunMetadata} from '../src/index.js';
const args=process.argv.slice(2);const arg=(n:string,d:string)=>args.includes(n)?args[args.indexOf(n)+1]??d:d;
const split=arg('--split','development');if(!['development','holdout'].includes(split))throw Error('Invalid split');
const rows=readFileSync(resolve('eval',split+'.jsonl'),'utf8').trim().split('\n').map(x=>JSON.parse(x));
const limit=Number(arg('--limit',String(rows.length)));if(!Number.isInteger(limit)||limit<1||limit>rows.length)throw Error('Invalid limit');
const selected=rows.slice(0,limit);const maxPerCall=((32768+2048)*2+1200*10)/1e6;
const plan={syntheticOnly:true,model:'gpt-6.1-sol',split,cases:selected.length,maxCalls:selected.length*4,retries:0,outputTokenCap:1200,inputByteCap:32768,planningEstimateUsd:selected.length*4*(3000*2+1200*10)/1e6,conservativeReservationUsd:selected.length*4*maxPerCall,notIncluded:'human review; token estimate is not observed billing',priceVersion:'openai-standard-2026-10-31',priceSource:'https://developers.openai.com/api/docs/models/gpt-6.1-sol'};
if(!args.includes('--live')){console.log(JSON.stringify({status:'PLAN_ONLY_NO_MODEL_CALLS',...plan},null,2));process.exit(0);}
const approvals=JSON.parse(readFileSync('APPROVALS.json','utf8'));
if(approvals.paidModelCalls!==true)throw Error('Paid calls require explicit approval recorded in APPROVALS.json');
const budget=Number(arg('--budget-usd','0'));
if(!Number.isFinite(budget)||budget<plan.conservativeReservationUsd||budget>Number(approvals.maxCostUsd??0))throw Error('Budget outside recorded approval');
if(!process.env.OPENAI_API_KEY)throw Error('Configure OPENAI_API_KEY in the server environment; do not commit it');
const adapter=new OpenAIAdapter(plan.model,process.env.OPENAI_API_KEY);
if(!(await adapter.checkAccess()).accessible)throw Error('Model access not verified for this account');
const engine=createEngine(createRunner(adapter));let reserved=0;const runs:ModelRunMetadata[]=[];const results:unknown[]=[];
const now=new Date().toISOString(),validUntil=new Date(Date.now()+3600000).toISOString();
const options=():RunOptions=>{if(reserved+maxPerCall>budget)throw Error('Batch budget exhausted');reserved+=maxPerCall;return {maxCalls:1,maxRetries:0,maxInputBytes:32768,maxOutputTokens:1200,timeoutMs:30000,maxCostUsd:maxPerCall,price:{version:plan.priceVersion,inputPerMillion:2,outputPerMillion:10},onMetadata:m=>runs.push(m)};};
for(const row of selected){
 const scope={schemaVersion:'1.0',actorId:'adult-roleplay-parent',householdId:'synthetic-family',participantIds:['adult-roleplay-parent','adult-roleplay-child'],now,timezone:'Asia/Seoul',purpose:'synthetic coordination evaluation',permissionEpoch:1};
 const privateInput={scope,current:{id:'current-'+row.id,revision:1,text:row.scenario,ownerId:scope.actorId,validUntil,state:'active'},memoryEnabled:false,historyStored:false,memories:[],route:'coordinate',clarificationTurns:0};
 try{
  const personal=await engine.personal(privateInput,options());
  if(personal.value.disposition==='private_support'){results.push({id:row.id,status:'PRIVATE_SUPPORT',personal:personal.value,humanReview:'pending'});continue;}
  const share=await engine.share(privateInput,{id:'card-'+row.id,revision:1,recipients:scope.participantIds,purpose:scope.purpose,constraintsOnly:true},options());
  // Explicit synthetic host attestation fixture; never a real authenticated approval.
  const joint={scope,cards:[{schemaVersion:'1.0',id:share.value.id,revision:share.value.revision,senderId:scope.actorId,householdId:scope.householdId,exactText:share.value.exactText,recipients:scope.participantIds,purpose:scope.purpose,validUntil,state:'active',hostVerified:true,permissionEpoch:1}],schedules:[]};
  const issue=await engine.analyze(joint,options());const agreement=await engine.propose(joint,{id:'agreement-'+row.id,revision:1},options());
  results.push({id:row.id,status:'GENERATED_NOT_QUALITY_PASSED',syntheticHostApproval:true,personal:personal.value,share:share.value,issue:issue.value,agreement:agreement.value,humanReview:'pending'});
 }catch(e){results.push({id:row.id,status:'ERROR',code:e instanceof RelationshipError?e.code:'HARNESS_ERROR',humanReview:'pending'});}
}
mkdirSync('eval/results',{recursive:true});const output=resolve('eval/results',`${split}-${Date.now()}.json`);
writeFileSync(output,JSON.stringify({plan,results,runs,reservedBudgetUsd:reserved,qualityVerdict:'NOT_EVALUATED_BY_HUMANS',data:'Synthetic only; model outputs retained here for explicit evaluation, not ordinary logs'},null,2));
console.log(JSON.stringify({output,cases:results.length,calls:runs.reduce((s,x)=>s+x.calls,0),qualityVerdict:'HUMAN_REVIEW_REQUIRED'}));
