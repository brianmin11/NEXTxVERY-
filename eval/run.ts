import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createEngine,createRunner,compileChangePlan,OpenAIAdapter,RelationshipError, type RunOptions, type ModelAdapter, type ModelRunMetadata} from '../src/index.js';
import {openEvaluationBudget,EvaluationBudgetExhausted} from './budget.js';
const args=process.argv.slice(2);const arg=(n:string,d:string)=>args.includes(n)?args[args.indexOf(n)+1]??d:d;
const split=arg('--split','development');if(!['development','holdout'].includes(split))throw Error('Invalid split');
const dataset=readFileSync(resolve('eval',split+'.jsonl'),'utf8');const rows=dataset.trim().split('\n').map(x=>JSON.parse(x));
const offset=Number(arg('--offset','0'));if(!Number.isInteger(offset)||offset<0||offset>=rows.length)throw Error('Invalid offset');
const limit=Number(arg('--limit',String(rows.length-offset)));if(!Number.isInteger(limit)||limit<1||offset+limit>rows.length)throw Error('Invalid limit');
const selected=rows.slice(offset,offset+limit);if(selected.some(row=>row.synthetic!==true))throw Error('Only synthetic rows are authorized');const maxPerCall=((32768+2048)*2+1200*10)/1e6;
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const provenance={commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),workingTreeDirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),datasetSha256:hash(dataset),runnerSha256:hash(readFileSync('dist/eval/run.js','utf8')),promptSha256:hash(readFileSync('dist/src/prompts/index.js','utf8')),schemaSha256:hash(readFileSync('dist/src/contracts/index.js','utf8')),adapterSha256:hash(readFileSync('dist/src/adapters/openai.js','utf8')),runtimeSha256:hash(readFileSync('dist/src/runtime.js','utf8')),startedAt:new Date().toISOString()};
const plan={syntheticOnly:true,model:'gpt-6.1-sol',split,offset,cases:selected.length,maxCalls:selected.length*4,retries:0,outputTokenCap:1200,inputByteCap:32768,planningEstimateUsd:selected.length*4*(3000*2+1200*10)/1e6,conservativeReservationUsd:selected.length*4*maxPerCall,notIncluded:'human review; token estimate is not observed billing',priceVersion:'openai-standard-2026-10-31',priceSource:'https://developers.openai.com/api/docs/models/gpt-6.1-sol'};
if(!args.includes('--live')){console.log(JSON.stringify({status:'PLAN_ONLY_NO_MODEL_CALLS',...plan},null,2));process.exit(0);}
const approvals=JSON.parse(readFileSync('APPROVALS.json','utf8'));
if(approvals.paidModelCalls!==true||approvals.model!==plan.model||approvals.syntheticOnly!==true||approvals.automaticRetries!==0||!approvals.approvalId||!Number.isInteger(approvals.maxCalls)||approvals.maxCalls<1)throw Error('Paid calls require explicit approval recorded in APPROVALS.json');
const budget=Number(arg('--budget-usd','0'));
if(!Number.isFinite(budget)||budget<plan.conservativeReservationUsd||budget>Number(approvals.maxCostUsd??0))throw Error('Budget outside recorded approval');
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
if(!process.env.OPENAI_API_KEY)throw Error('Configure OPENAI_API_KEY in the server environment; do not commit it');
const adapter=new OpenAIAdapter(plan.model,process.env.OPENAI_API_KEY);
if(!(await adapter.checkAccess()).accessible)throw Error('Model access not verified for this account');
const ledger=openEvaluationBudget('eval/results',approvals.approvalId,approvals.maxCalls,approvals.maxCostUsd);
try {
let caseId='',stage='personal';const captured:unknown[]=[];
// Evaluation-only capture of synthetic outputs; never installed in the production adapter.
const recordingAdapter:ModelAdapter={name:adapter.name,model:adapter.model,async generate(req){stage=req.stage;const reply=await adapter.generate(req);captured.push({caseId,stage,value:reply.value});return reply;}};
const engine=createEngine(createRunner(recordingAdapter));let reserved=0;const runs:(ModelRunMetadata&{caseId:string;stage:string})[]=[];const results:unknown[]=[];
const output=resolve('eval/results',`${split}-${Date.now()}.json`);
let finish='running';const checkpoint=()=>writeFileSync(output,JSON.stringify({plan,provenance,finish,unexecutedCaseIds:selected.slice(results.length).map(row=>row.id),results,runs,captured,reservedBudgetUsd:reserved,qualityVerdict:'NOT_EVALUATED_BY_HUMANS',data:'Synthetic only; model outputs retained here for explicit evaluation, not ordinary logs'},null,2),{mode:0o600});
const now=new Date().toISOString(),validUntil=new Date(Date.now()+3600000).toISOString();
const options=():RunOptions=>{if(reserved+maxPerCall>budget)throw new EvaluationBudgetExhausted('Batch budget exhausted');ledger.reserve(maxPerCall);reserved+=maxPerCall;return {maxCalls:1,maxRetries:0,maxInputBytes:32768,maxOutputTokens:1200,timeoutMs:30000,maxCostUsd:maxPerCall,price:{version:plan.priceVersion,inputPerMillion:2,outputPerMillion:10},onMetadata:m=>runs.push({...m,caseId,stage})};};
for(const row of selected){
 caseId=row.id;stage='personal';
 const scope={schemaVersion:'1.0',actorId:'adult-roleplay-parent',householdId:'synthetic-family',participantIds:['adult-roleplay-parent','adult-roleplay-child'],now,timezone:'Asia/Seoul',purpose:'synthetic coordination evaluation',permissionEpoch:1};
 const privateInput={scope,current:{id:'current-'+row.id,revision:1,text:row.scenario,ownerId:scope.actorId,validUntil,state:'active'},memoryEnabled:false,historyStored:false,memories:[],route:row.route??'coordinate',clarificationTurns:0};
 try{
  const personal=await engine.personal(privateInput,options());
  if(personal.value.disposition==='private_support'){results.push({id:row.id,status:'PRIVATE_SUPPORT',personal:personal.value,humanReview:'pending'});continue;}
  if(privateInput.route==='reflect'){results.push({id:row.id,status:'REFLECTION_ONLY',personal:personal.value,humanReview:'pending'});continue;}
  if(personal.value.disposition==='clarification_required'){results.push({id:row.id,status:'CLARIFICATION_REQUIRED',personal:personal.value,humanReview:'pending'});continue;}
  stage='share';const share=await engine.share(privateInput,{id:'card-'+row.id,revision:1,recipients:scope.participantIds.filter(x=>x!==scope.actorId),purpose:scope.purpose,constraintsOnly:true},options());
  // Explicit synthetic host attestation fixture; never a real authenticated approval.
  const joint={scope,cards:[{schemaVersion:'1.0',id:share.value.id,revision:share.value.revision,senderId:scope.actorId,householdId:scope.householdId,exactText:share.value.exactText,recipients:scope.participantIds.filter(x=>x!==scope.actorId),purpose:scope.purpose,validUntil,state:'active',hostVerified:true,permissionEpoch:1},...(row.approvedContributions??[]).map((contribution:{senderId:string;text:string},i:number)=>({schemaVersion:'1.0',id:'independent-card-'+row.id+'-'+i,revision:1,senderId:contribution.senderId,householdId:scope.householdId,exactText:contribution.text,recipients:scope.participantIds.filter(x=>x!==contribution.senderId),purpose:scope.purpose,validUntil,state:'active',hostVerified:true,permissionEpoch:1}))],schedules:[]};
  stage='issue';const issue=await engine.analyze(joint,options());stage='agreement';const agreement=await engine.propose(joint,{id:'agreement-'+row.id,revision:1},options());
  results.push({id:row.id,status:'GENERATED_NOT_QUALITY_PASSED',syntheticHostApproval:true,personal:personal.value,share:share.value,issue:issue.value,agreement:agreement.value,changePlan:compileChangePlan(agreement.value,joint),humanReview:'pending'});
 }catch(e){if(e instanceof EvaluationBudgetExhausted){finish='budget_exhausted';break;}results.push({id:row.id,stage,status:'ERROR',code:e instanceof RelationshipError?e.code:'HARNESS_ERROR',providerDetails:e instanceof RelationshipError?e.providerDetails:undefined,humanReview:'pending'});if(e instanceof RelationshipError&&e.providerDetails)break;}finally{checkpoint();console.log(JSON.stringify({caseId,completed:results.length,total:selected.length}));}
}
if(finish==='running')finish=results.length===selected.length?'completed':'stopped';checkpoint();
console.log(JSON.stringify({output,cases:results.length,calls:runs.reduce((s,x)=>s+x.calls,0),qualityVerdict:'HUMAN_REVIEW_REQUIRED'}));

} finally { ledger.close(); }
