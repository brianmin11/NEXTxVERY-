import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {execFileSync} from 'node:child_process';
test('summary distinguishes partial cases and preserves human ratings across reruns',()=>{
 const cwd=mkdtempSync(join(tmpdir(),'rai-summary-'));const script=resolve('dist/eval/summarize.js');
 try{
 mkdirSync(join(cwd,'eval/results'),{recursive:true});
 writeFileSync(join(cwd,'eval/development.jsonl'),JSON.stringify({id:'K01',synthetic:true})+'\n');writeFileSync(join(cwd,'eval/holdout.jsonl'),JSON.stringify({id:'H01',synthetic:true})+'\n');
 writeFileSync(join(cwd,'eval/results/budget.json'),JSON.stringify({reservedCalls:1,reservedUsd:.1}));
 const report={plan:{split:'development'},results:[],runs:[{caseId:'K01',stage:'personal',calls:1,usageComplete:true,inputTokens:1,outputTokens:2,estimatedCostUsd:.000022,promptVersion:'test'}]};
 writeFileSync(join(cwd,'eval/results/development-1.json'),JSON.stringify(report));
 const run=()=>execFileSync(process.execPath,[script],{cwd,stdio:'pipe'});run();
 const summary=JSON.parse(readFileSync(join(cwd,'eval/results/summary.json'),'utf8'));
 assert.deepEqual(summary.neverAttemptedCaseIds,['H01']);assert.equal(summary.latestCases.INCOMPLETE,1);
 const path=join(cwd,'eval/results/human-review.jsonl');const review=JSON.parse(readFileSync(path,'utf8').trim());review.reviewers[0].notes='human annotation';review.reviewers[0].ratings.naturalness=3;writeFileSync(path,JSON.stringify(review)+'\n');
 run();assert.equal(JSON.parse(readFileSync(path,'utf8').trim()).reviewers[0].notes,'human annotation');
 writeFileSync(join(cwd,'eval/results/development-2.json'),JSON.stringify(report));run();
 const reviews=readFileSync(path,'utf8').trim().split('\n').map(line=>JSON.parse(line));assert.equal(reviews.length,2);assert.equal(reviews[0].reviewers[0].ratings.naturalness,3);
 }finally{rmSync(cwd,{recursive:true,force:true});}
});
