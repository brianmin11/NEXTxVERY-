import { createHash } from 'node:crypto';
import { z } from 'zod';
import { PrivateContext, JointContext, Scope, DerivedArtifactMetadata, RelationshipError, VERSION, type Evidence } from '../../contracts/index.js';
import { POLICY_VERSION } from '../../prompts/index.js';
export { POLICY_VERSION };
export interface AllowedSource { id:string; revision:number; text:string; ownerId:string; validUntil:string }
export function parse<T>(schema:z.ZodType<T>, value:unknown, code:'INPUT_INVALID'|'SCHEMA_INVALID'='INPUT_INVALID'):T {
 const parsed=schema.safeParse(value); if(!parsed.success) throw new RelationshipError(code); return parsed.data;
}
export function stable(value:unknown):string {
 if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
 if(value!==null && typeof value==='object') return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+stable(v)).join(',')+'}';
 return JSON.stringify(value)??'null';
}
export const hash=(value:unknown)=>createHash('sha256').update(stable(value)).digest('hex');
export function scopeValid(scope:z.infer<typeof Scope>) {
 try { new Intl.DateTimeFormat('en',{timeZone:scope.timezone}).format(new Date(scope.now)); } catch { throw new RelationshipError('INPUT_INVALID'); }
 if(!scope.participantIds.includes(scope.actorId)||new Set(scope.participantIds).size!==scope.participantIds.length)throw new RelationshipError('INPUT_INVALID');
}
function unique(sources:AllowedSource[]) { if(new Set(sources.map(s=>s.id)).size!==sources.length)throw new RelationshipError('INPUT_INVALID'); }
export function privateContext(input:unknown) {
 const c=parse(PrivateContext,input);scopeValid(c.scope);
 if(c.current.ownerId!==c.scope.actorId||c.memories.some(m=>m.ownerId!==c.scope.actorId))throw new RelationshipError('POLICY_RESTRICTED');
 if(c.current.state!=='active'||Date.parse(c.current.validUntil)<=Date.parse(c.scope.now))throw new RelationshipError('STALE_CONTEXT');
 const memories=c.memoryEnabled?c.memories.filter(m=>m.state==='active'&&Date.parse(m.validUntil)>Date.parse(c.scope.now)):[];
 const sources:AllowedSource[]=[c.current,...memories];unique(sources);
 return {context:c,sources,projection:{scope:c.scope,current:c.current,memories,route:c.route,clarificationTurns:c.clarificationTurns}};
}
export function jointContext(input:unknown) {
 const c=parse(JointContext,input);scopeValid(c.scope);
 for(const card of c.cards){
  if(card.householdId!==c.scope.householdId||card.purpose!==c.scope.purpose||!c.scope.participantIds.includes(card.senderId)||c.scope.participantIds.some(p=>p!==card.senderId&&!card.recipients.includes(p)))throw new RelationshipError('POLICY_RESTRICTED');
  if(card.state!=='active'||card.permissionEpoch!==c.scope.permissionEpoch||Date.parse(card.validUntil)<=Date.parse(c.scope.now))throw new RelationshipError('STALE_CONTEXT');
 }
 for(const s of c.schedules){
  if(Date.parse(s.end)<=Date.parse(s.start)||s.participantIds.some(p=>!c.scope.participantIds.includes(p)))throw new RelationshipError('INPUT_INVALID');
 }
 const expiry=c.cards.reduce((a,b)=>Date.parse(a)<Date.parse(b.validUntil)?a:b.validUntil,c.cards[0]!.validUntil);
 const sources:AllowedSource[]=[...c.cards.map(c=>({id:c.id,revision:c.revision,text:c.exactText,ownerId:c.senderId,validUntil:c.validUntil})),...c.schedules.map(s=>({id:s.id,revision:s.revision,text:[s.title,s.start,s.end].join('\n'),ownerId:c.scope.actorId,validUntil:expiry}))];unique(sources);
 // Only allowlisted fields enter a joint model call; no private artifact metadata or history path exists.
 const projection={scope:c.scope,cards:c.cards.map(card=>({id:card.id,revision:card.revision,senderId:card.senderId,text:card.exactText})),schedules:c.schedules};
 return {context:c,sources,projection};
}
export function validateEvidence(evidence:z.infer<typeof Evidence>[],sources:AllowedSource[]) {
 for(const e of evidence){ const s=sources.find(s=>s.id===e.sourceId&&s.revision===e.revision); if(!s||!e.quote.trim()||!s.text.includes(e.quote))throw new RelationshipError('SEMANTIC_INVALID'); }
}
export function metadata(scope:z.infer<typeof Scope>,sources:AllowedSource[],visibility:'private'|'shared',projection:unknown):DerivedArtifactMetadata {
 return {schemaVersion:VERSION,visibility,sourceVersions:sources.map(s=>({id:s.id,revision:s.revision})),audience:visibility==='private'?[scope.actorId]:scope.participantIds,purpose:scope.purpose,permissionEpoch:scope.permissionEpoch,validUntil:sources.reduce((a,b)=>Date.parse(a)<Date.parse(b.validUntil)?a:b.validUntil,sources[0]!.validUntil),policyVersion:POLICY_VERSION,inputHash:hash(projection)};
}
export function assertStillFresh(sources:AllowedSource[],now:string,started:number){if(sources.some(s=>Date.parse(s.validUntil)<=Date.parse(now)+(performance.now()-started)))throw new RelationshipError('STALE_CONTEXT');}
export interface ArtifactNode { id:string;revision:number;metadata:DerivedArtifactMetadata }
export interface SourceChange { id:string;revision:number;state:'active'|'revoked'|'deleted'|'corrected' }
/** Pure invalidation discovery, not deletion and not revocation of an independently accepted agreement. */
export function invalidatedArtifacts(artifacts:ArtifactNode[],changes:SourceChange[]):number[] {
 const invalid=new Set<number>();const changed=new Map(changes.map(c=>[c.id,c]));
 if(new Set(artifacts.map(a=>a.id)).size!==artifacts.length)throw new RelationshipError('INPUT_INVALID');
 for(const a of artifacts){parse(DerivedArtifactMetadata,a.metadata);if(!a.id||!Number.isInteger(a.revision)||a.revision<1)throw new RelationshipError('INPUT_INVALID');}
 let progress=true;while(progress){progress=false;artifacts.forEach((artifact,i)=>{if(invalid.has(i))return;if(artifact.metadata.sourceVersions.some(ref=>{const c=changed.get(ref.id);return !!c&&(c.state!=='active'||c.revision!==ref.revision);})){invalid.add(i);changed.set(artifact.id,{id:artifact.id,revision:artifact.revision,state:'revoked'});progress=true;}});}
 return [...invalid].sort((a,b)=>a-b);
}
