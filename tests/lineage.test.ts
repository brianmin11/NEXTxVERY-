import test from 'node:test';
import assert from 'node:assert/strict';
import { invalidatedArtifacts } from '../src/lib/server/context.js';
import type { DerivedArtifactMetadata } from '../src/contracts/index.js';
function meta(id:string,revision=1):DerivedArtifactMetadata {return {schemaVersion:'1.0',visibility:'private',sourceVersions:[{id,revision}],audience:['child'],purpose:'schedule',permissionEpoch:4,validUntil:'2026-12-01T00:00:00+09:00',policyVersion:'test',inputHash:'test'};}
test('revocation invalidates direct and transitive derived artifacts, not unrelated agreement',()=>{
 const artifacts=[{id:'summary',revision:1,metadata:meta('private-entry')},{id:'proposal',revision:1,metadata:meta('summary')},{id:'independent-agreement',revision:1,metadata:meta('independent-approved-card')}];
 const affected=invalidatedArtifacts(artifacts,[{id:'private-entry',revision:1,state:'revoked'}]);
 assert.deepEqual([...affected].sort(),[0,1]);
});
test('source correction or new version invalidates older derived artifacts',()=>{
 for(const change of [{id:'card',revision:1,state:'corrected' as const},{id:'card',revision:2,state:'active' as const}])assert.deepEqual(invalidatedArtifacts([{id:'result',revision:1,metadata:meta('card')}],[change]),[0]);
});
test('same active version does not invalidate',()=>assert.deepEqual(invalidatedArtifacts([{id:'result',revision:1,metadata:meta('card')}],[{id:'card',revision:1,state:'active'}]),[]));
