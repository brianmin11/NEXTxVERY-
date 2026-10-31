import 'server-only';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import approvals from '../../../APPROVALS.json';
import { createEngine, createRunner, OpenAIAdapter, RelationshipError, type Runner, type RunOptions, type ModelRunMetadata } from '@family-os/relationship-ai';
// Approved synthetic integration envelope. No production monthly entitlement is implied.
export const callOptions:RunOptions={maxCalls:1,maxRetries:0,maxInputBytes:32768,maxOutputTokens:2600,timeoutMs:60000,maxCostUsd:0.15,price:{version:'openai-standard-2026-10-31',inputPerMillion:2,outputPerMillion:10}};
function ledger(){
 const path=resolve(process.env.INTEGRATION_BUDGET_PATH||'.data/integration-budget.sqlite');
 mkdirSync(dirname(path),{recursive:true,mode:0o700});
 const db=new DatabaseSync(path);db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS reservations(id TEXT PRIMARY KEY, reserved REAL NOT NULL, created TEXT NOT NULL, metadata TEXT);');chmodSync(path,0o600);return db;
}
export function getEngine(signal?:AbortSignal){
 const available=process.env.INTEGRATION_LIVE_APPROVED==='true' && !!process.env.OPENAI_API_KEY;
 const base=available?createRunner(new OpenAIAdapter('gpt-6.1-sol',process.env.OPENAI_API_KEY!)):null;
 const runner:Runner={async run(stage,schema,input,options){
  if(!base)throw new RelationshipError('PROVIDER_ERROR');
  const db=ledger(), id=randomUUID();
  try{
   db.exec('BEGIN IMMEDIATE');
   const used=db.prepare('SELECT count(*) calls, coalesce(sum(reserved),0) usd FROM reservations').get() as {calls:number;usd:number};
   // Earlier approved evaluation reserved109 calls / $8.897888; preserve total ceilings128/$12.
   if(used.calls>=approvals.integration.maxCalls || used.usd+callOptions.maxCostUsd>approvals.integration.additionalMaxCostUsd || approvals.integration.priorReservedCalls+used.calls+1>approvals.maxCalls || approvals.integration.priorReservedUsd+used.usd+callOptions.maxCostUsd>approvals.maxCostUsd)throw new RelationshipError('BUDGET_EXCEEDED');
   db.prepare('INSERT INTO reservations(id,reserved,created) VALUES(?,?,?)').run(id,callOptions.maxCostUsd,new Date().toISOString());
   db.exec('COMMIT');
  }catch(e){if(db.isTransaction)db.exec('ROLLBACK');db.close();throw e;}
  let metadata:ModelRunMetadata|undefined;
  try{return await base.run(stage,schema,input,{...options,...callOptions,signal:signal??options.signal,onMetadata:m=>{metadata=m;options.onMetadata?.(m);}});}
  finally{db.prepare('UPDATE reservations SET metadata=? WHERE id=?').run(metadata?JSON.stringify(metadata):null,id);db.close();}
 }};
 return {engine:createEngine(runner),runOptions:{...callOptions,signal},modelMode:available?'live' as const:'unconfigured' as const};
}
