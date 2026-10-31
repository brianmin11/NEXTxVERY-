import {readFileSync,readdirSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
const dir='eval/results';
const files=readdirSync(dir).filter(f=>/^(development|holdout)-\d+\.json$/.test(f)).sort((a,b)=>Number(a.match(/\d+/)?.[0])-Number(b.match(/\d+/)?.[0]));
const reports=files.map(file=>({file,...JSON.parse(readFileSync(resolve(dir,file),'utf8'))}));
const runs=reports.flatMap(report=>report.runs.map((run:any)=>({...run,file:report.file,split:report.plan.split})));
const latest=new Map<string,any>();
for(const report of reports){
 const common={split:report.plan.split,file:report.file,datasetSha256:report.provenance?.datasetSha256,promptSha256:report.provenance?.promptSha256,promptVersions:[...new Set(report.runs.map((run:any)=>run.promptVersion))]};
 for(const run of report.runs)if(run.caseId)latest.set(run.caseId,{id:run.caseId,status:'INCOMPLETE',stage:run.stage,...common});
 for(const result of report.results)latest.set(result.id,{...result,...common,captured:report.captured?.filter((item:any)=>item.caseId===result.id)??[]});
}
const counts=(items:any[],key:(x:any)=>string)=>items.reduce((out:Record<string,number>,x)=>{const name=key(x);out[name]=(out[name]??0)+1;return out;},{});
const ledger=JSON.parse(readFileSync(resolve(dir,'budget.json'),'utf8'));
const observed=runs.filter(run=>run.usageComplete&&run.estimatedCostUsd!==null);
const allCases=['development','holdout'].flatMap(split=>readFileSync(`eval/${split}.jsonl`,'utf8').trim().split('\n').map(line=>JSON.parse(line)));
const summary={generatedAt:new Date().toISOString(),syntheticOnly:true,reports:files,latestCases:counts([...latest.values()],x=>x.status),latestByCase:[...latest.values()].map(({id,split,file,status,code,stage,promptVersions,datasetSha256,promptSha256,completedStages,unmetRequiredStages,expectationMatched,operationalIssues})=>({id,split,file,status,code,stage,promptVersions,datasetSha256,promptSha256,completedStages,unmetRequiredStages,expectationMatched,operationalIssues})),automaticCaseChecksPassed:[...latest.values()].filter(x=>x.expectationMatched===true&&x.unmetRequiredStages?.length===0&&!['ERROR','HARNESS_ERROR','INCOMPLETE'].includes(x.status)).length,casesWithOperationalIssues:[...latest.values()].filter(x=>x.operationalIssues?.length).map(x=>({id:x.id,issues:x.operationalIssues})),latestCompletedStages:counts([...latest.values()].flatMap(x=>x.completedStages??[]),x=>x),neverAttemptedCaseIds:allCases.filter(row=>!latest.has(row.id)).map(row=>row.id),providerRequests:runs.reduce((sum,run)=>sum+run.calls,0),observedUsageRequests:observed.reduce((sum,run)=>sum+run.calls,0),unknownUsageRequests:runs.filter(run=>!run.usageComplete).reduce((sum,run)=>sum+run.calls,0),observedInputTokens:observed.reduce((sum,run)=>sum+run.inputTokens,0),observedOutputTokens:observed.reduce((sum,run)=>sum+run.outputTokens,0),knownUsageEstimatedCostUsd:observed.reduce((sum,run)=>sum+run.estimatedCostUsd,0),actualBilledCostUsd:null,stageRequests:counts(runs,x=>x.stage??'legacy-unlabelled'),providerOrRuntimeErrors:counts(runs.filter(run=>run.errorCode),x=>x.errorCode),latestCaseErrors:counts([...latest.values()].filter(x=>x.status==='ERROR'),x=>x.code),reservedCalls:ledger.reservedCalls,conservativeReservedUsd:ledger.reservedUsd,remainingApprovedCallSlots:128-ledger.reservedCalls,humanRatings:'NOT_COLLECTED',qualityVerdict:'NOT_HUMAN_VALIDATED',appIntegration:'NOT_VERIFIED'};
writeFileSync(resolve(dir,'summary.json'),JSON.stringify(summary,null,2)+'\n',{mode:0o600});
const reviewPath=resolve(dir,'human-review.jsonl');
const existing=existsSync(reviewPath)?readFileSync(reviewPath,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line)):[];
const priorReviews=new Map(existing.map(row=>[row.result.id+'@'+row.result.file,row.reviewers]));
const review=[...latest.values()].map(result=>({case:allCases.find(row=>row.id===result.id),result,reviewers:priorReviews.get(result.id+'@'+result.file)??[1,2].map(reviewer=>({reviewer,ratings:{naturalness:null,requestPreservation:null,balance:null,autonomy:null,feasibility:null,factVsInference:null},criticalFailure:{privateLeak:null,inventedConsent:null,unsupportedAssignmentOrDate:null,unsafeJointMediation:null},notes:''}))}));
// Keep previous-run reviews too: a newer model result must not destroy earlier human work.
const keys=new Set(review.map(row=>row.result.id+'@'+row.result.file));
const preserved=existing.filter(row=>!keys.has(row.result.id+'@'+row.result.file));
writeFileSync(reviewPath,[...preserved,...review].map(row=>JSON.stringify(row)).join('\n')+'\n',{mode:0o600});
console.log(JSON.stringify(summary,null,2));
