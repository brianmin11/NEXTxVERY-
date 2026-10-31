import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {openEvaluationBudget} from '../eval/budget.js';
test('evaluation approval limits persist across runs and prevent concurrent use',()=>{
 const dir=mkdtempSync(join(tmpdir(),'rai-budget-'));try{
 const first=openEvaluationBudget(dir,'approval',2,1);first.reserve(.4);assert.throws(()=>openEvaluationBudget(dir,'approval',2,1));first.close();
 const second=openEvaluationBudget(dir,'approval',2,1);assert.throws(()=>second.reserve(.7));second.reserve(.4);assert.throws(()=>second.reserve(.01));second.close();
 assert.throws(()=>openEvaluationBudget(dir,'different-approval',2,1));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('corrupt budget ledger is not silently reset',()=>{const dir=mkdtempSync(join(tmpdir(),'rai-budget-'));try{writeFileSync(join(dir,'budget.json'),'{}');assert.throws(()=>openEvaluationBudget(dir,'approval',128,12));}finally{rmSync(dir,{recursive:true,force:true});}});
