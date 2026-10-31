import { z } from 'zod';
import { PersonalResult, SharedPrior, ShareCardDraft, IssueAnalysis, AgreementDraft, RelationshipError, VERSION, id, type RelationshipEngine, type Runner, type RunOptions, type ModelRunMetadata } from '../../contracts/index.js';
import { privateContext, jointContext, parse, metadata, validateEvidence, assertStillFresh, stable, hash, POLICY_VERSION } from './context.js';
import { validateAgreement } from './compile.js';
const ShareOutput=ShareCardDraft.extend({safetyDisposition:z.enum(['ordinary','private_support'])});
const RevisionSettings=z.strictObject({id,revision:z.number().int().positive()});
const ShareSettings=RevisionSettings.extend({recipients:z.array(id).min(1),purpose:z.string().min(1),constraintsOnly:z.boolean()});
const Feedback=z.strictObject({actorId:id,instruction:z.string().max(6000),action:z.enum(['revise','defer','decline'])});
function noModel():ModelRunMetadata{return {adapter:'none',model:'none',promptVersion:'none',policyVersion:POLICY_VERSION,schemaVersion:VERSION,calls:0,retries:0,latencyMs:0,inputTokens:0,outputTokens:0,estimatedCostUsd:0,priceVersion:null,usageComplete:true,errorCode:null};}
function checkOptions(options:RunOptions){if(options.signal?.aborted)throw new RelationshipError('CANCELLED');}
export function createEngine(runner:Runner):RelationshipEngine {
 return {
 async personal(input,options){
  checkOptions(options);const started=performance.now();const {context:c,sources,projection}=privateContext(input);
  const result=await runner.run('personal',PersonalResult,projection,options);const v=parse(PersonalResult,result.value,'SCHEMA_INVALID');
  for(const claim of v.claims){validateEvidence(claim.evidence,sources);if(claim.speakerId!==c.scope.actorId||claim.kind==='interpretation'&&claim.epistemicStatus!=='interpretation')throw new RelationshipError('SEMANTIC_INVALID');}
  // The user's selected route is authoritative. Model suggestions cannot escalate it.
  if(v.suggestedRoute!==c.route&&v.disposition!=='private_support')throw new RelationshipError('SEMANTIC_INVALID');
  if(v.disposition==='private_support')v.suggestedRoute='reflect';
  if(c.clarificationTurns>=2){v.questions=[];if(v.disposition!=='private_support')v.disposition='clarification_required';}
  assertStillFresh(sources,c.scope.now,started);checkOptions(options);
  return {value:v,metadata:metadata(c.scope,sources,'private',projection),run:result.run};
 },
 async share(input,rawSettings,options){
  checkOptions(options);const started=performance.now();const {context:c,sources,projection}=privateContext(input);const settings=parse(ShareSettings,rawSettings);
  if(c.route==='reflect')throw new RelationshipError('POLICY_RESTRICTED');
  if(settings.purpose!==c.scope.purpose||settings.recipients.some(p=>p===c.scope.actorId||!c.scope.participantIds.includes(p))||new Set(settings.recipients).size!==settings.recipients.length)throw new RelationshipError('POLICY_RESTRICTED');
  const request={...projection,settings};const result=await runner.run('share',ShareOutput,request,options);const v=parse(ShareOutput,result.value,'SCHEMA_INVALID');
  if(v.safetyDisposition==='private_support')throw new RelationshipError('POLICY_RESTRICTED');
  if(v.id!==settings.id||v.revision!==settings.revision||stable(v.recipients)!==stable(settings.recipients)||v.purpose!==settings.purpose)throw new RelationshipError('SEMANTIC_INVALID');
  const {safetyDisposition:_,...draft}=v;assertStillFresh(sources,c.scope.now,started);checkOptions(options);
  // Still private: this metadata must never be promoted with the approved public card.
  return {value:draft,metadata:metadata(c.scope,sources,'private',request),run:result.run};
 },
 async analyze(input,options){
  checkOptions(options);const started=performance.now();const {context:c,sources,projection}=jointContext(input);
  const result=await runner.run('issue',IssueAnalysis,projection,options);const v=parse(IssueAnalysis,result.value,'SCHEMA_INVALID');
  for(const item of [...v.commonGoals,...v.differingExpectations,...v.conflicts])validateEvidence(item.evidence,sources);
  // Host-known participants without an approved contribution cannot be inferred by the model.
  v.unrepresentedParticipantIds=c.scope.participantIds.filter(p=>!c.cards.some(card=>card.senderId===p));
  if(v.unrepresentedParticipantIds.length&&!v.unknowns.includes('일부 당사자의 입장은 아직 확인되지 않았습니다.'))v.unknowns.push('일부 당사자의 입장은 아직 확인되지 않았습니다.');
  assertStillFresh(sources,c.scope.now,started);checkOptions(options);
  return {value:v,metadata:metadata(c.scope,sources,'shared',projection),run:result.run};
 },
 async propose(input,rawSettings,options){
  checkOptions(options);const started=performance.now();const {context:c,sources,projection}=jointContext(input);const settings=parse(RevisionSettings,rawSettings);
  if(settings.revision!==1)throw new RelationshipError('INPUT_INVALID');
  const request={...projection,settings};const result=await runner.run('agreement',AgreementDraft,request,options);const v=parse(AgreementDraft,result.value,'SCHEMA_INVALID');
  if(v.id!==settings.id||v.revision!==settings.revision||v.status!=='draft')throw new RelationshipError('SEMANTIC_INVALID');
  validateAgreement(v,sources,c.scope.participantIds);v.changes=[];assertStillFresh(sources,c.scope.now,started);checkOptions(options);
  return {value:v,metadata:metadata(c.scope,sources,'shared',request),run:result.run};
 },
 async revise(input,rawPrior,rawFeedback,options){
  checkOptions(options);const started=performance.now();const {context:c,sources,projection}=jointContext(input);const envelope=parse(SharedPrior,rawPrior);const prior=envelope.draft;const m=envelope.metadata;
  if(envelope.contentHash!==hash(prior)||envelope.latestRevision!==prior.revision||m.permissionEpoch!==c.scope.permissionEpoch||m.purpose!==c.scope.purpose||stable([...m.audience].sort())!==stable([...c.scope.participantIds].sort())||Date.parse(m.validUntil)<=Date.parse(c.scope.now)||!m.sourceVersions.length||m.sourceVersions.some(ref=>!sources.some(s=>s.id===ref.id&&s.revision===ref.revision)))throw new RelationshipError('STALE_CONTEXT');
  const feedback=parse(Feedback,rawFeedback);
  validateAgreement(prior,sources,c.scope.participantIds);
  if(feedback.actorId!==c.scope.actorId||!prior.parties.includes(feedback.actorId))throw new RelationshipError('POLICY_RESTRICTED');
  if(prior.status==='declined')throw new RelationshipError('POLICY_RESTRICTED');
  const request={...projection,prior,feedback,requiredRevision:prior.revision+1};let v:AgreementDraft;let run:ModelRunMetadata;
  if(feedback.action==='defer'||feedback.action==='decline'){
   v={...prior,revision:prior.revision+1,status:feedback.action==='defer'?'deferred':'declined',acceptanceInheritance:false,changes:[]};run=noModel();
  } else {
   const result=await runner.run('revise',AgreementDraft,request,options);v=parse(AgreementDraft,result.value,'SCHEMA_INVALID');run=result.run;
   if(v.id!==prior.id||v.revision!==prior.revision+1||v.status!=='draft')throw new RelationshipError('SEMANTIC_INVALID');
   validateAgreement(v,sources,c.scope.participantIds);
  }
  v.changes=(['parties','summary','options','actions','unknowns','status'] as const).filter(k=>stable(prior[k])!==stable(v[k])).map(k=>`${k} changed`);
  assertStillFresh(sources,c.scope.now,started);checkOptions(options);
  return {value:v,metadata:metadata(c.scope,sources,'shared',request),run};
 }
 };
}
