import 'server-only';
import { getActor, getDatabase } from './auth';
import { getEngine } from './provider';
import { createFamilyService, HostError } from './family-service';
import { Command } from '../../contracts/family';
import { RelationshipError } from '@family-os/relationship-ai';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function handleFamily(request:Request){
 try{
  if(request.method==='POST'){
   const origin=new URL(process.env.BETTER_AUTH_URL||'http://localhost:3100').origin;
   if(request.headers.get('origin')!==origin)return Response.json({error:{code:'ORIGIN_REJECTED',message:'이 요청을 처리할 수 없어요.'}},{status:403,headers});
  }
  const actor=await getActor(request.headers);
  if(!actor)return Response.json({error:{code:'UNAUTHENTICATED',message:'로그인이 필요해요.'}},{status:401,headers});
  const service=createFamilyService({db:getDatabase(),...getEngine(request.signal)});
  if(request.method==='GET')return Response.json(service.read(actor),{headers});
  const raw=await request.text();
  if(Buffer.byteLength(raw)>24000)return Response.json({error:{code:'INPUT_INVALID',message:'입력 내용을 줄여 주세요.'}},{status:413,headers});
  let parsed:unknown;try{parsed=JSON.parse(raw);}catch{return Response.json({error:{code:'INPUT_INVALID',message:'입력 형식을 확인해 주세요.'}},{status:422,headers});}
  const command=Command.safeParse(parsed);
  if(!command.success)return Response.json({error:{code:'INPUT_INVALID',message:'필수 항목과 날짜를 확인해 주세요.'}},{status:422,headers});
  return Response.json(await service.command(actor,command.data),{headers});
 }catch(e){
  if(e instanceof HostError)return Response.json({error:{code:e.code,message:e.message}},{status:e.status,headers});
  if(e instanceof RelationshipError){
   const authFailure=e.providerDetails?.status===401||e.providerDetails?.status===403;
   const code=authFailure?'PROVIDER_AUTH_FAILED':e.code;
   const message=code==='BUDGET_EXCEEDED'?'현재 사용할 수 있는 AI 한도에 도달했어요.':code==='STALE_CONTEXT'?'내용이 변경됐어요. 새로고침한 뒤 다시 확인해 주세요.':code==='POLICY_RESTRICTED'?'이 요청은 공유 단계로 진행할 수 없어요. 개인 공간에서 내용을 확인해 주세요.':'AI 정리를 완료하지 못했어요. 입력을 확인하고 나중에 다시 시도해 주세요.';
   return Response.json({error:{code,message}},{status:code==='BUDGET_EXCEEDED'?429:code==='STALE_CONTEXT'?409:503,headers});
  }
  const err=e as {code?:string;status?:number;message?:string};
  if(err.status && err.status>=400 && err.status<500 && err.code)return Response.json({error:{code:err.code,message:err.message||'요청을 다시 확인해 주세요.'}},{status:err.status,headers});
  return Response.json({error:{code:'SERVER_ERROR',message:'요청을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.'}},{status:503,headers});
 }
}
