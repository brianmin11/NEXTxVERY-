import { z } from 'zod';
import { AgreementDraft, ChangePlanDraft, RelationshipError, Action, VERSION } from '../../contracts/index.js';
import { jointContext, parse, hash, validateEvidence, type AllowedSource } from './context.js';
export function validateAgreement(agreement:AgreementDraft,sources:AllowedSource[],participants:string[]) {
 if(new Set(agreement.parties).size!==agreement.parties.length||agreement.parties.some(p=>!participants.includes(p)))throw new RelationshipError('SEMANTIC_INVALID');
 for(const a of agreement.actions){
  validateEvidence(a.evidence,sources);
  if(a.assigneeId!==null&&!agreement.parties.includes(a.assigneeId)||a.reminderRecipients.some(p=>!agreement.parties.includes(p)))throw new RelationshipError('SEMANTIC_INVALID');
  // A literal origin is a conservative structural check, not proof of entailment.
  // Nonliteral inferred times must be explicitly marked proposed for human review.
  if(a.basis==='sourced'){
   const quotes=a.evidence.map(e=>e.quote).join('\n');
   for(const time of [a.start,a.end,a.deadline,a.until,a.reminderAt])if(time&&!quotes.includes(time))throw new RelationshipError('SEMANTIC_INVALID');
   if(a.assigneeId&&!a.evidence.some(e=>sources.some(s=>s.id===e.sourceId&&s.ownerId===a.assigneeId))&&!quotes.includes(a.assigneeId))throw new RelationshipError('SEMANTIC_INVALID');
  }
 }
}
function weekday(ms:number,tz:string){const name=new Intl.DateTimeFormat('en-US',{timeZone:tz,weekday:'short'}).format(ms);return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(name);}
function wallTime(ms:number,tz:string){return new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(ms);}
export function compileChangePlan(raw:unknown,rawContext:unknown):ChangePlanDraft {
 const a=parse(AgreementDraft,raw);const {context:c,sources}=jointContext(rawContext);validateAgreement(a,sources,c.scope.participantIds);
 const blockers:string[]=[];const block=(i:number,why:string)=>blockers.push(`actions[${i}]: ${why}`);
 if(a.status!=='draft')blockers.push('AGREEMENT_NOT_DRAFT');
 if(a.unknowns.length)blockers.push('AGREEMENT_HAS_UNRESOLVED_FIELDS');
 a.actions.forEach((action,i)=>{
  const time=(s:string|null)=>s===null?null:Date.parse(s);
  const start=time(action.start),end=time(action.end),deadline=time(action.deadline),until=time(action.until),reminder=time(action.reminderAt),now=Date.parse(c.scope.now);
  if(!action.description.trim())block(i,'DESCRIPTION_REQUIRED');
  if(action.unresolvedFields.length)block(i,'UNRESOLVED_FIELDS');
  if(action.assigneeId===null)block(i,'ASSIGNEE_REQUIRED');
  if(action.recurrence===null)block(i,'RECURRENCE_REQUIRED');
  if(action.kind==='schedule_create'||action.kind==='schedule_update'){
   if(start===null||end===null)block(i,'SCHEDULE_RANGE_REQUIRED');
   if(action.kind==='schedule_update'&&(!action.targetId||!c.schedules.some(s=>s.id===action.targetId)))block(i,'KNOWN_UPDATE_TARGET_REQUIRED');
   if(action.kind==='schedule_create'&&action.targetId!==null)block(i,'CREATE_HAS_UPDATE_TARGET');
  }
  if((action.kind==='role_assignment'||action.kind==='followup')&&deadline===null)block(i,'DEADLINE_REQUIRED');
  if(action.kind==='reminder_policy'&&(reminder===null||!action.reminderRecipients.length))block(i,'REMINDER_DETAILS_REQUIRED');
  if(action.maxReminders>0&&(reminder===null||!action.reminderRecipients.length))block(i,'REMINDER_DETAILS_REQUIRED');
  if(new Set(action.reminderRecipients).size!==action.reminderRecipients.length)block(i,'DUPLICATE_RECIPIENTS');
  if(action.kind!=='schedule_update'&&action.kind!=='schedule_create'&&action.targetId!==null)block(i,'UNSUPPORTED_TARGET_REQUIRES_HOST_CONTRACT');
  for(const [name,value] of Object.entries({start,end,deadline,until,reminder}))if(value!==null&&value<now)block(i,`${name.toUpperCase()}_IN_PAST`);
  if(start!==null&&end!==null&&end<=start)block(i,'INVALID_RANGE');
  if(start!==null&&deadline!==null&&deadline<start)block(i,'DEADLINE_BEFORE_START');
  if(deadline!==null&&reminder!==null&&reminder>deadline)block(i,'REMINDER_AFTER_DEADLINE');
  if(action.recurrence==='none'&&(until!==null||action.weekdays.length))block(i,'NONRECURRING_HAS_REPEAT_FIELDS');
  if(action.recurrence==='daily'||action.recurrence==='weekly'){
   if(start===null||end===null||until===null)block(i,'BOUNDED_REPEAT_RANGE_REQUIRED');
   if(start!==null&&until!==null&&until<start)block(i,'REPEAT_END_BEFORE_START');
   if(start!==null&&until!==null&&until-start>366*86400000)block(i,'REPEAT_HORIZON_EXCEEDS_366_DAYS');
   if(action.recurrence==='weekly'&&(!action.weekdays.length||new Set(action.weekdays).size!==action.weekdays.length))block(i,'WEEKDAYS_REQUIRED_OR_DUPLICATE');
   if(action.recurrence==='daily'&&action.weekdays.length)block(i,'DAILY_HAS_WEEKDAYS');
   if(start!==null&&action.recurrence==='weekly'&&!action.weekdays.includes(weekday(start,c.scope.timezone)))block(i,'START_NOT_ON_REPEAT_WEEKDAY');
  }
  if(start!==null&&end!==null&&end>start){
   const starts:number[]=[start];
   if(action.recurrence&&action.recurrence!=='none'&&until!==null&&until>=start&&until-start<=366*86400000){
    for(let d=start+86400000;d<=until;d+=86400000){
     // Never guess DST normalization. A host can revise with explicit dates.
     if(wallTime(d,c.scope.timezone)!==wallTime(start,c.scope.timezone)){block(i,'DST_RECURRENCE_REQUIRES_EXPLICIT_OCCURRENCES');break;}
     if(action.recurrence==='daily'||action.weekdays.includes(weekday(d,c.scope.timezone)))starts.push(d);
    }
   }
   for(const s of c.schedules)if(s.id!==action.targetId&&action.assigneeId&&s.participantIds.includes(action.assigneeId)&&starts.some(t=>t<Date.parse(s.end)&&t+(end-start)>Date.parse(s.start)))block(i,'SCHEDULE_CONFLICT');
  }
 });
 // Check collisions introduced by the same plan, not only existing calendar entries.
 a.actions.forEach((x,i)=>a.actions.slice(i+1).forEach(y=>{if(x.assigneeId&&x.assigneeId===y.assigneeId&&x.start&&x.end&&y.start&&y.end&&Date.parse(x.start)<Date.parse(y.end)&&Date.parse(x.end)>Date.parse(y.start))block(i,'INTRA_PLAN_CONFLICT');}));
 return parse(ChangePlanDraft,{schemaVersion:VERSION,status:'draft',executable:false,agreementId:a.id,agreementRevision:a.revision,semanticHash:hash({agreement:a,timezone:c.scope.timezone,householdId:c.scope.householdId,purpose:c.scope.purpose,permissionEpoch:c.scope.permissionEpoch}),changes:a.actions,blockers:[...new Set(blockers)],requiresHostRevalidation:true});
}
export function verifyAcceptanceVersion(raw:unknown,acceptance:{agreementId:string;revision:number;semanticHash:string}):boolean {
 const result=ChangePlanDraft.safeParse(raw);if(!result.success||!acceptance)return false;const p=result.data;
 return p.agreementId===acceptance.agreementId&&p.agreementRevision===acceptance.revision&&p.semanticHash===acceptance.semanticHash;
}
