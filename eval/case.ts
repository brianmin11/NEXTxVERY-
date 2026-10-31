import {z} from 'zod';
import {Schedule,Source,ErrorCode,compileChangePlan,hash,RelationshipError,type RelationshipEngine,type RunOptions} from '../src/index.js';
export const EvaluationCase=z.object({
 id:z.string(),synthetic:z.literal(true),scenario:z.string(),split:z.enum(['development','holdout']),mode:z.enum(['personal','flow','joint']),route:z.enum(['reflect','share','coordinate']).default('coordinate'),
 actorId:z.string().default('adult-roleplay-parent'),participantIds:z.array(z.string()).default(['adult-roleplay-parent','adult-roleplay-child']),now:z.string().datetime().optional(),
 clarificationAnswer:z.string().optional(),memoryEnabled:z.boolean().default(false),memories:z.array(Source).default([]),
 approvedContributions:z.array(z.object({senderId:z.string(),text:z.string(),state:z.enum(['active','revoked','deleted','corrected']).default('active')})).default([]),schedules:z.array(Schedule).default([]),
 revisionFeedback:z.string().optional(),variants:z.array(z.object({scenario:z.string(),actorId:z.string()})).default([]),
 requiredStages:z.array(z.string()),expectedTerminal:z.string().optional(),expectedError:ErrorCode.optional(),
}).passthrough();
export type EvaluationCase=z.infer<typeof EvaluationCase>;
export const maximumCalls=(row:EvaluationCase)=>row.mode==='joint'?2+Number(!!row.revisionFeedback):row.mode==='personal'?1+row.variants.length:4+Number(!!row.clarificationAnswer)+Number(!!row.revisionFeedback);
export async function executeCase(row:EvaluationCase,engine:RelationshipEngine,options:(stage:string)=>RunOptions){
 const now=row.now??new Date().toISOString(),validUntil=new Date(Date.parse(now)+3600000).toISOString();
 const scope={schemaVersion:'1.0',actorId:row.actorId,householdId:'synthetic-family',participantIds:row.participantIds,now,timezone:'Asia/Seoul',purpose:'synthetic coordination evaluation',permissionEpoch:1};
 const completedStages:string[]=[];const artifacts:Record<string,any>={};let stage='input';
 const call=async<T>(name:string,fn:(opts:RunOptions)=>Promise<T>)=>{stage=name;const result=await fn(options(name));completedStages.push(name);return result;};
 const finish=(status:string,error?:RelationshipError)=>({id:row.id,mode:row.mode,status,stage,code:error?.code,providerDetails:error?.providerDetails,completedStages,artifacts,requiredStages:row.requiredStages,unmetRequiredStages:row.requiredStages.filter(s=>!completedStages.includes(s)),operationalIssues:[artifacts.changePlan,artifacts.revisedChangePlan].filter(Boolean).flatMap(plan=>plan.blockers.filter((blocker:string)=>/IN_PAST|INVALID|END_BEFORE|UNTIL_BEFORE|TIMEZONE|EXCEEDS|INTRA_PLAN_CONFLICT|SCHEDULE_CONFLICT/.test(blocker))),expectedTerminal:row.expectedTerminal,expectationMatched:error?row.expectedError===error.code:!row.expectedError&&(!row.expectedTerminal||row.expectedTerminal===status),humanReview:'pending'});
 const makePrivate=(scenario:string,actorId:string,revision=1,turns=0)=>({scope:{...scope,actorId},current:{id:'current-'+row.id,revision,text:scenario,ownerId:actorId,validUntil,state:'active'},memoryEnabled:row.memoryEnabled,historyStored:true,memories:row.memories,route:row.route,clarificationTurns:turns});
 const makeJoint=(cards:{senderId:string;text:string;state:string}[])=>({scope,cards:cards.map((c,i)=>({schemaVersion:'1.0',id:'approved-'+row.id+'-'+i,revision:1,senderId:c.senderId,householdId:scope.householdId,exactText:c.text,recipients:scope.participantIds.filter(p=>p!==c.senderId),purpose:scope.purpose,validUntil,state:c.state,hostVerified:true,permissionEpoch:1})),schedules:row.schedules});
 try{
  let joint;
  if(row.mode==='joint'){
   // Pre-authored independent synthetic host-approved inputs. No private result is promoted.
   joint=makeJoint(row.approvedContributions);artifacts.jointFixture=true;
  }else{
   let input=makePrivate(row.scenario,row.actorId);let personal=await call('personal',o=>engine.personal(input,o));artifacts.personal=personal.value;
   if(row.mode==='personal'&&row.variants.length){artifacts.variants=[];for(const variant of row.variants){const result=await call('personal_variant',o=>engine.personal(makePrivate(variant.scenario,variant.actorId),o));artifacts.variants.push({input:variant,result:result.value});}return finish('VARIANTS_EVALUATED');}
   if(personal.value.disposition==='private_support')return finish('PRIVATE_SUPPORT');
   if(row.route==='reflect')return finish('REFLECTION_ONLY');
   if(row.mode==='flow'&&personal.value.disposition==='clarification_required'&&row.clarificationAnswer){
    input=makePrivate(row.scenario+'\n추가 답변: '+row.clarificationAnswer,row.actorId,2,1);
    personal=await call('personal_clarification',o=>engine.personal(input,o));artifacts.personal=personal.value;
    if(personal.value.disposition==='private_support')return finish('PRIVATE_SUPPORT');
   }
   if(personal.value.disposition==='clarification_required')return finish('CLARIFICATION_REQUIRED');
   if(row.mode==='personal')return finish('PERSONAL_READY');
   const share=await call('share',o=>engine.share(input,{id:'card-'+row.id,revision:1,recipients:scope.participantIds.filter(p=>p!==row.actorId),purpose:scope.purpose,constraintsOnly:true},o));artifacts.share=share.value;
   // Explicit synthetic host approval, only within this evaluation. Never inferred from model text.
   joint=makeJoint([{senderId:row.actorId,text:share.value.exactText,state:'active'},...row.approvedContributions]);artifacts.syntheticHostApproval=true;
  }
  const issue=await call('issue',o=>engine.analyze(joint,o));artifacts.issue=issue.value;
  const agreement=await call('agreement',o=>engine.propose(joint,{id:'agreement-'+row.id,revision:1},o));artifacts.agreement=agreement.value;
  stage='compile';artifacts.changePlan=compileChangePlan(agreement.value,joint);completedStages.push('compile');
  if(row.revisionFeedback){
   const prior={draft:agreement.value,metadata:agreement.metadata,contentHash:hash(agreement.value),latestRevision:agreement.value.revision};
   const revised=await call('revise',o=>engine.revise(joint,prior,{actorId:row.actorId,instruction:row.revisionFeedback!,action:'revise'},o));artifacts.revised=revised.value;stage='compile_revision';artifacts.revisedChangePlan=compileChangePlan(revised.value,joint);completedStages.push('compile_revision');
   // Defer/decline are deterministic forks of the same original version, not new paid calls.
   const localOptions:RunOptions={maxCalls:1,maxRetries:0,maxInputBytes:32768,maxOutputTokens:1200,timeoutMs:30000,maxCostUsd:0};
   for(const action of ['defer','decline'] as const){stage=action;artifacts[action]=(await engine.revise(joint,prior,{actorId:row.actorId,instruction:'합성 사용자의 명시적 '+action,action},localOptions)).value;completedStages.push(action);}
  }
  return finish('GENERATED_NOT_QUALITY_PASSED');
 }catch(error){if(error instanceof RelationshipError)return finish(row.expectedError===error.code?'EXPECTED_ERROR':'ERROR',error);throw error;}
}
