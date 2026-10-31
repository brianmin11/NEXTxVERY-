import { z } from 'zod';
import type { PersonalResult, ShareCardDraft, IssueAnalysis } from '@family-os/relationship-ai';
import type { AgreementDraft } from '@family-os/relationship-ai';
export type Actor = { id: string; name: string; email: string };
export type Member = { id: string; name: string };
export type Schedule = { id: string; revision: number; title: string; start: string; end: string; participantIds: string[]; originPlanId?: string };
export type PrivateEntry = { id: string; revision: number; text: string; route: 'reflect'|'share'|'coordinate'; coordinationId: string; personal?: z.infer<typeof PersonalResult>; shareDraft?: z.infer<typeof ShareCardDraft> };
export type SharedCard = { id: string; revision: number; senderId: string; exactText: string; recipients: string[]; state: 'active'|'revoked'; approvedAt: string };
export type ExecutionPlan = { id: string; revision: number; digest: string; agreementId: string; agreementRevision: number; title: string; start: string; end: string; participantIds: string[]; targetId: string; targetRevision: number; requiredAcceptors: string[]; acceptedBy: string[]; status: 'awaiting_acceptance'|'accepted'|'applied'|'stale'; blockers: string[]; appliedScheduleId?: string };
export type Coordination = { id: string; revision: number; audience: string[]; cards: SharedCard[]; analysis?: z.infer<typeof IssueAnalysis>; agreement?: AgreementDraft; plan?: ExecutionPlan; state: 'open'|'deferred'|'declined'|'applied'|'stale' };
export type FamilyView = { viewer: Actor; household: { id: string; name: string; inviteCode: string }|null; members: Member[]; schedules: Schedule[]; privateEntries: PrivateEntry[]; coordinations: Coordination[]; modelMode: 'live'|'test'|'unconfigured' };
const id=z.string().min(1).max(128), revision=z.number().int().positive();
const instant=z.iso.datetime({offset:true});
const requestId=z.string().min(8).max(128);
export const Command=z.discriminatedUnion('type',[
 z.object({type:z.literal('household.create'),name:z.string().trim().min(1).max(80),requestId}),
 z.object({type:z.literal('household.join'),inviteCode:z.string().min(16).max(128),requestId}),
 z.object({type:z.literal('schedule.create'),title:z.string().trim().min(1).max(200),start:instant,end:instant,participantIds:z.array(id).min(1).max(20),requestId}),
 z.object({type:z.literal('private.create'),text:z.string().trim().min(1).max(6000),route:z.enum(['reflect','share','coordinate']),coordinationId:id.optional(),requestId}),
 z.object({type:z.literal('private.analyze'),id,expectedRevision:revision,requestId}),
 z.object({type:z.literal('private.share'),id,expectedRevision:revision,recipients:z.array(id).min(1).max(20),constraintsOnly:z.boolean(),requestId}),
 z.object({type:z.literal('share.approve'),id,expectedRevision:revision,exactText:z.string().trim().min(1).max(6000),recipients:z.array(id).min(1).max(20),requestId}),
 z.object({type:z.literal('share.revoke'),id,cardId:id,expectedRevision:revision,requestId}),
 z.object({type:z.literal('coordination.generate'),id,expectedRevision:revision,requestId}),
 z.object({type:z.literal('coordination.revise'),id,expectedRevision:revision,instruction:z.string().max(6000),action:z.enum(['revise','defer','decline']),requestId}),
 z.object({type:z.literal('plan.resolve'),id,expectedRevision:revision,title:z.string().trim().min(1).max(200),start:instant,end:instant,participantIds:z.array(id).min(1).max(20),targetId:id,requestId}),
 z.object({type:z.literal('plan.accept'),id,expectedRevision:revision,planId:id,planRevision:revision,digest:z.string().min(1),requestId}),
 z.object({type:z.literal('plan.apply'),id,expectedRevision:revision,planId:id,planRevision:revision,digest:z.string().min(1),requestId}),
]);
export type Command = z.infer<typeof Command>;
export type CommandResult = { view: FamilyView; createdId?: string };
export type ApiError = { error: { code: string; message: string } };
