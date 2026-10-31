import { z } from 'zod';
export const VERSION = '1.0' as const;
export const id = z.string().min(1).max(128);
export const text = z.string().max(6000);
export const instant = z.iso.datetime({ offset: true });
export const Source = z.strictObject({ id, revision: z.number().int().positive(), text, ownerId: id, validUntil: instant, state: z.enum(['active','revoked','deleted','corrected']) });
export const Scope = z.strictObject({ schemaVersion: z.literal(VERSION), actorId: id, householdId: id, participantIds: z.array(id).min(1).max(20), now: instant, timezone: z.string(), purpose: z.string().min(1), permissionEpoch: z.number().int().nonnegative() });
export const PrivateContext = z.strictObject({ scope: Scope, current: Source, memoryEnabled: z.boolean(), historyStored: z.boolean(), memories: z.array(Source).max(100), route: z.enum(['reflect','share','coordinate']), clarificationTurns: z.number().int().min(0).max(3) });
export const Evidence = z.strictObject({ sourceId: id, revision: z.number().int().positive(), quote: z.string().min(1).max(2000) });
export const Claim = z.strictObject({ speakerId: id, kind: z.enum(['expressed_emotion','observation','want','avoid','constraint','interpretation','unknown']), statement: text, epistemicStatus: z.enum(['self_report','interpretation','unknown']), evidence: z.array(Evidence).min(1).max(10) });
export const PersonalResult = z.strictObject({ response: text, claims: z.array(Claim).max(30), unknowns: z.array(text).max(20), questions: z.array(text).max(3), disposition: z.enum(['ready','clarification_required','private_support']), suggestedRoute: z.enum(['reflect','share','coordinate']) });
export const ShareCardDraft = z.strictObject({ schemaVersion: z.literal(VERSION), id, revision: z.number().int().positive(), status: z.literal('draft'), exactText: text, recipients: z.array(id).min(1), purpose: text, reviewItems: z.array(text), });
// These fields are a host attestation, never proof of authentication by themselves.
export const ApprovedShareCard = z.strictObject({ schemaVersion: z.literal(VERSION), id, revision: z.number().int().positive(), senderId: id, householdId: id, exactText: text, recipients: z.array(id).min(1), purpose: text, validUntil: instant, state: z.enum(['active','revoked','deleted','corrected']), hostVerified: z.literal(true), permissionEpoch: z.number().int().nonnegative() });
export const Schedule = z.strictObject({ id, revision: z.number().int().positive(), participantIds: z.array(id), start: instant, end: instant, title: text });
export const JointContext = z.strictObject({ scope: Scope, cards: z.array(ApprovedShareCard).min(1).max(40), schedules: z.array(Schedule).max(100) });
export const GroundedText = z.strictObject({ text, evidence: z.array(Evidence).min(1) });
export const IssueAnalysis = z.strictObject({ commonGoals: z.array(GroundedText), differingExpectations: z.array(GroundedText), conflicts: z.array(GroundedText), unknowns: z.array(text), questions: z.array(text).max(3), unrepresentedParticipantIds: z.array(id) });
export const Action = z.strictObject({ kind: z.enum(['schedule_create','schedule_update','role_assignment','reminder_policy','followup']), targetId: id.nullable(), assigneeId: id.nullable(), description: text, start: instant.nullable(), end: instant.nullable(), deadline: instant.nullable(), recurrence: z.enum(['none','daily','weekly']).nullable(), weekdays: z.array(z.number().int().min(0).max(6)), until: instant.nullable(), preparation: text.nullable(), followup: text.nullable(), exception: text.nullable(), reminderRecipients: z.array(id), reminderAt: instant.nullable(), maxReminders: z.number().int().min(0).max(5), basis: z.enum(['sourced','proposed']), evidence: z.array(Evidence).min(1), unresolvedFields: z.array(text) });
export const AgreementDraft = z.strictObject({ schemaVersion: z.literal(VERSION), id, revision: z.number().int().positive(), status: z.enum(['draft','deferred','declined']), parties: z.array(id).min(1), summary: text, options: z.array(text).max(5), actions: z.array(Action).max(20), unknowns: z.array(text), changes: z.array(text), acceptanceInheritance: z.literal(false) });
export const DerivedArtifactMetadata = z.strictObject({ schemaVersion: z.literal(VERSION), visibility: z.enum(['private','shared']), sourceVersions: z.array(z.strictObject({ id, revision: z.number().int().positive() })), audience: z.array(id), purpose: text, permissionEpoch: z.number().int(), validUntil: instant, policyVersion: z.string(), inputHash: z.string(), });
export const ChangePlanDraft = z.strictObject({ schemaVersion: z.literal(VERSION), status: z.literal('draft'), executable: z.literal(false), agreementId: id, agreementRevision: z.number().int().positive(), semanticHash: z.string(), changes: z.array(Action), blockers: z.array(text), requiresHostRevalidation: z.literal(true), });
export const ErrorCode = z.enum(['INPUT_INVALID','CLARIFICATION_REQUIRED','POLICY_RESTRICTED','MODEL_REFUSAL','TIMEOUT','RATE_LIMIT','TRUNCATED','SCHEMA_INVALID','SEMANTIC_INVALID','BUDGET_EXCEEDED','CANCELLED','STALE_CONTEXT','PROVIDER_ERROR']);
export type ErrorCode = z.infer<typeof ErrorCode>;
export class RelationshipError extends Error { constructor(public code: ErrorCode, public retryable = false) { super(code); this.name='RelationshipError'; } }
export const ModelRunMetadata = z.strictObject({ adapter: z.string(), model: z.string(), promptVersion: z.string(), policyVersion: z.string(), schemaVersion: z.literal(VERSION), calls: z.number().int(), retries: z.number().int(), latencyMs: z.number(), inputTokens: z.number().nullable(), outputTokens: z.number().nullable(), estimatedCostUsd: z.number().nullable(), priceVersion: z.string().nullable(), usageComplete: z.boolean(), errorCode: ErrorCode.nullable() });
export type PrivateContext = z.infer<typeof PrivateContext>;
export type JointContext = z.infer<typeof JointContext>;
export type AgreementDraft = z.infer<typeof AgreementDraft>;
export type DerivedArtifactMetadata = z.infer<typeof DerivedArtifactMetadata>;
export type ChangePlanDraft = z.infer<typeof ChangePlanDraft>;
export type ModelRunMetadata = z.infer<typeof ModelRunMetadata>;
export type Stage = 'personal'|'share'|'issue'|'agreement'|'revise';
export interface ModelRequest { stage: Stage; system: string; input: unknown; schema: z.ZodType; maxOutputTokens: number; signal: AbortSignal }
export interface ModelReply { value: unknown; model: string; inputTokens: number|null; outputTokens: number|null }
export interface ModelAdapter { readonly name: string; readonly model: string; generate(request: ModelRequest): Promise<ModelReply> }
export interface RunOptions { maxCalls: number; maxRetries: number; maxInputBytes: number; maxOutputTokens: number; timeoutMs: number; maxCostUsd: number; signal?: AbortSignal; price?: { version: string; inputPerMillion: number; outputPerMillion: number }; onMetadata?: (metadata: ModelRunMetadata)=>void }
export interface StageResult<T> { value: T; metadata: DerivedArtifactMetadata; run: ModelRunMetadata }
export interface Runner { run<T>(stage: Stage, schema: z.ZodType<T>, input: unknown, options: RunOptions): Promise<{ value: T; run: ModelRunMetadata }> }
export interface RelationshipEngine {
 personal(input: unknown, options: RunOptions): Promise<StageResult<z.infer<typeof PersonalResult>>>;
 share(input: unknown, settings: { id: string; revision: number; recipients: string[]; purpose: string; constraintsOnly: boolean }, options: RunOptions): Promise<StageResult<z.infer<typeof ShareCardDraft>>>;
 analyze(input: unknown, options: RunOptions): Promise<StageResult<z.infer<typeof IssueAnalysis>>>;
 propose(input: unknown, settings: { id: string; revision: number }, options: RunOptions): Promise<StageResult<AgreementDraft>>;
 revise(input: unknown, prior: unknown, feedback: { actorId: string; instruction: string; action: 'revise'|'defer'|'decline' }, options: RunOptions): Promise<StageResult<AgreementDraft>>;
}
