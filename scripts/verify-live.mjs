// Explicitly invoked paid synthetic browser verification. No automatic provider retries.
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const base=process.env.BASE_URL||'http://localhost:3111';
const path='.data/live-checkpoint.json';
mkdirSync('.data',{recursive:true});mkdirSync('evidence/screenshots',{recursive:true});
const saved=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{day:new Date(Date.now()+4*86400000).toISOString().slice(0,10),nameA:'통합 검증 A',nameB:'통합 검증 B',title:'합성 가족 저녁 약속',secret:`나만 보는 합성 표식 ${randomUUID()}`};
function checkpoint(){writeFileSync(path,JSON.stringify(saved,null,2),{mode:0o600});}
checkpoint();
const browser=await chromium.launch({channel:'chrome',headless:true});
const ca=await browser.newContext({viewport:{width:390,height:844},...(existsSync('.data/live-a.json')?{storageState:'.data/live-a.json'}:{})});
const cb=await browser.newContext({viewport:{width:1280,height:900},...(existsSync('.data/live-b.json')?{storageState:'.data/live-b.json'}:{})});
const a=await ca.newPage(),b=await cb.newPage();
for(const p of [a,b]) p.setDefaultTimeout(15000);
const errors=[];for(const p of [a,b])p.on('pageerror',e=>errors.push(e.message));
async function view(p){const r=await p.request.get(`${base}/api/family`);expect(r.status()).toBe(200);return r.json();}
async function clickCommand(p,label){
 const responsePromise=p.waitForResponse(r=>r.url()===`${base}/api/family`&&r.request().method()==='POST',{timeout:150000});
 await p.getByRole('button',{name:label,exact:true}).click();
 const r=await responsePromise;const data=await r.json();if(!r.ok())throw Error(`Command ${label}: ${r.status()} ${JSON.stringify(data)}`);await expect(p.getByText('처리 중이에요. 잠시 기다려 주세요.',{exact:true})).toBeHidden();return data;
}
async function signup(p,context,key,name){
 if(saved[key])return;
 await p.goto(`${base}/login`);await p.getByRole('button',{name:'처음이에요 · 계정 만들기',exact:true}).click();
 await p.getByLabel('이름',{exact:true}).fill(name);await p.getByLabel('이메일',{exact:true}).fill(`live-${randomUUID()}@example.test`);await p.getByLabel('비밀번호',{exact:true}).fill(`Synthetic-${randomUUID()}!`);
 await p.getByRole('button',{name:'계정 만들기',exact:true}).click();await expect(p).toHaveURL(/\/(home|more)$/);
 const v=await view(p);saved[key]=v.viewer.id;await context.storageState({path:key==='aId'?'.data/live-a.json':'.data/live-b.json'});checkpoint();
}
async function privateFlow(p,key,name,other,reply=false){
 let v=await view(p);
 if(!saved[key]){
  await p.goto(`${base}/home/heart${reply?`?coordinationId=${saved.coordId}`:''}`);
  if(reply)await p.getByRole('button',{name:'내 입장 정리해서 답하기',exact:true}).click();else await p.getByRole('button',{name:'새 이야기',exact:true}).click();
  await p.getByRole('radio',{name:'생활 일정·역할 조율하기'}).check();
  const publicText=`${saved.day}의 '${saved.title}' 일정을 기존 18:00~19:00에서 19:00~20:00로 한 번만 옮기고 싶어요. 한국 시간이고 참여자는 우리 두 사람 그대로예요. 반복과 알림은 필요 없어요.`;
  await p.getByLabel('내 이야기',{exact:true}).fill(reply?`나는 변경 가능한 시간이 19:00~20:00예요. ${publicText}`:`개인 사유는 공유하고 싶지 않아요. ${saved.secret}. ${publicText}`);
  const r=await clickCommand(p,'개인 공간에 저장');saved[key]=r.createdId;checkpoint();v=r.view;
 }
 await p.goto(`${base}/home/heart?privateId=${saved[key]}`);
 let entry=v.privateEntries.find(e=>e.id===saved[key]);
 if(!entry.personal){await clickCommand(p,'내 표현 정리하기');v=await view(p);entry=v.privateEntries.find(e=>e.id===saved[key]);console.log(`${key}: personal complete`);}
 if(saved[key+'Shared'])return;
 if(!entry.shareDraft){await p.getByRole('checkbox',{name:other,exact:true}).check();await p.getByRole('checkbox',{name:'이유는 빼고 필요한 조건만 전달',exact:true}).check();await clickCommand(p,'공유 문구 만들기');console.log(`${key}: share draft complete`);}
 // A real reviewer edit: deterministic fixture text is input, never a product fallback response.
 const exact=`${saved.day} '${saved.title}'을 19:00~20:00(한국 시간)로 이번 한 번만 옮기는 데 동의해요. 참여자는 우리 두 사람이고 반복·추가 알림은 없어요.`;
 await p.getByLabel('전달할 문장',{exact:true}).fill(exact);
 await p.getByRole('checkbox',{name:'전달할 문구와 받는 사람을 확인했어요.',exact:true}).check();
 const r=await clickCommand(p,'이 문구 보내기');saved.coordId=r.createdId;saved[key+'Shared']=true;checkpoint();
 expect(JSON.stringify(r.view.coordinations)).not.toContain(saved.secret);
 console.log(`${key}: authenticated share approved`);
}
try{
 await signup(a,ca,'aId',saved.nameA);await signup(b,cb,'bId',saved.nameB);
 let av=await view(a);expect(av.modelMode).toBe('live');
 if(!av.household){await a.goto(`${base}/more`);await a.getByLabel('가족 이름',{exact:true}).fill('실모델 합성 검증 가족');await clickCommand(a,'우리집 만들기');av=await view(a);}
 if(!(await view(b)).household){await b.goto(`${base}/more`);await b.getByLabel('초대 코드',{exact:true}).fill(av.household.inviteCode);await clickCommand(b,'가족에 참여하기');}
 av=await view(a);
 if(!saved.scheduleId){
  await a.goto(`${base}/calendar`);await a.getByLabel('일정 이름',{exact:true}).fill(saved.title);await a.getByLabel('시작',{exact:true}).fill(`${saved.day}T18:00`);await a.getByLabel('종료',{exact:true}).fill(`${saved.day}T19:00`);await a.getByRole('checkbox',{name:saved.nameB,exact:true}).check();const r=await clickCommand(a,'일정 저장');saved.scheduleId=r.createdId;checkpoint();
 }
 await privateFlow(a,'privateA',saved.nameA,saved.nameB);
 expect(JSON.stringify(await view(b))).not.toContain(saved.secret);
 await privateFlow(b,'privateB',saved.nameB,saved.nameA,true);
 await a.goto(`${base}/home/heart?coordinationId=${saved.coordId}`);
 let coord=(await view(a)).coordinations.find(c=>c.id===saved.coordId);
 if(!coord.agreement){await clickCommand(a,'함께 조율하기');console.log('joint: live analysis and agreement complete');coord=(await view(a)).coordinations.find(c=>c.id===saved.coordId);}
 expect(coord.analysis).toBeTruthy();expect(coord.agreement).toBeTruthy();
 if(!coord.plan){
  await a.getByRole('button',{name:'일정 변경 내용 정하기',exact:true}).click();await a.getByLabel('변경할 일정',{exact:true}).selectOption(saved.scheduleId);
  await a.getByRole('checkbox',{name:'아래 한 건의 변경만 별도로 확정해요. 다른 제안은 반영하지 않아요.',exact:true}).check();
  await a.getByLabel('시작',{exact:true}).fill(`${saved.day}T19:00`);await a.getByLabel('종료',{exact:true}).fill(`${saved.day}T20:00`);await clickCommand(a,'실행 내용 검토하기');coord=(await view(a)).coordinations.find(c=>c.id===saved.coordId);
 }
 if(!coord.plan.acceptedBy.includes(saved.aId))await clickCommand(a,'이 내용 수락');
 await a.evaluate(()=>window.scrollTo(0,0));await a.screenshot({path:'evidence/screenshots/live-plan-mobile.png',fullPage:true});
 await b.goto(`${base}/home/heart?coordinationId=${saved.coordId}`);coord=(await view(b)).coordinations.find(c=>c.id===saved.coordId);
 if(!coord.plan.acceptedBy.includes(saved.bId))await clickCommand(b,'이 내용 수락');
 coord=(await view(b)).coordinations.find(c=>c.id===saved.coordId);
 if(coord.plan.status!=='applied')await clickCommand(b,'우리집에 반영');
 await b.evaluate(()=>window.scrollTo(0,0));await b.screenshot({path:'evidence/screenshots/live-applied-desktop.png',fullPage:true});
 await a.goto(`${base}/calendar`);await a.reload();
 av=await view(a);const result=av.schedules.find(s=>s.id===saved.scheduleId);
 expect(result.revision).toBe(2);expect(Date.parse(result.start)).toBe(Date.parse(`${saved.day}T19:00:00+09:00`));expect(Date.parse(result.end)).toBe(Date.parse(`${saved.day}T20:00:00+09:00`));
 expect(JSON.stringify(await view(b))).not.toContain(saved.secret);expect(errors).toEqual([]);
 await a.screenshot({path:'evidence/screenshots/live-calendar-mobile.png',fullPage:true});
 const report={verifiedAt:new Date().toISOString(),provider:'live gpt-6.1-sol',twoAuthenticatedAccounts:saved.aId!==saved.bId,privateIsolation:true,sharedCards:2,jointAnalysis:true,agreement:true,requiredAcceptors:2,appliedOnce:true,persistedScheduleRevision:result.revision,reloadVerified:true,browserPageErrors:errors,scheduleId:saved.scheduleId,coordinationId:saved.coordId};
 writeFileSync('evidence/live-browser.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch(e){await a.screenshot({path:'.data/live-failure-a.png',fullPage:true});await b.screenshot({path:'.data/live-failure-b.png',fullPage:true});console.error(e.message);process.exitCode=1;}
finally{await browser.close();}
