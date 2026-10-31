import {createRunner,createEngine,type RunOptions} from '../src/index.js';
import {ScriptedAdapter} from '../src/adapters/scripted.js';
const now='2026-10-31T12:00:00Z';
const input={scope:{schemaVersion:'1.0',actorId:'parent',householdId:'synthetic',participantIds:['parent','child'],now,timezone:'Asia/Seoul',purpose:'reflect',permissionEpoch:1},current:{id:'message1',revision:1,text:'오늘은 마음만 정리하고 싶어요.',ownerId:'parent',validUntil:'2026-11-01T12:00:00Z',state:'active'},memoryEnabled:false,historyStored:true,memories:[],route:'reflect',clarificationTurns:0};
const fixture={response:'마음을 정리하는 경로입니다.',claims:[{speakerId:'parent',kind:'want',statement:'마음을 정리하고 싶음',epistemicStatus:'self_report',evidence:[{sourceId:'message1',revision:1,quote:'마음만 정리하고 싶어요.'}]}],unknowns:[],questions:[],disposition:'ready',suggestedRoute:'reflect'};
const options:RunOptions={maxCalls:1,maxRetries:0,maxInputBytes:32768,maxOutputTokens:1200,timeoutMs:1000,maxCostUsd:0,price:{version:'TEST_ONLY_NO_BILLING',inputPerMillion:0,outputPerMillion:0}};
const result=await createEngine(createRunner(new ScriptedAdapter([fixture]))).personal(input,options);
console.log(JSON.stringify({mode:'TEST_ONLY_NO_LANGUAGE_QUALITY_CLAIM',result},null,2));
