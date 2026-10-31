import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { HomeScreen } from '@/components/home/home-screen';
import { getActor, getDatabase } from '@/src/lib/server/auth';
import { getEngine } from '@/src/lib/server/provider';
import { createFamilyService } from '@/src/lib/server/family-service';
import type { HomeData } from '@/lib/home.fixture';
export const dynamic='force-dynamic';
export default async function HomePage(){
 const actor=await getActor(await headers());if(!actor)redirect('/login');
 const view=createFamilyService({db:getDatabase(),...getEngine()}).read(actor);
 if(!view.household)redirect('/more');
 const dayKey=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'});
 const today=dayKey.format(new Date());
 const tones=['apricot','sky','butter','sage'] as const;
 const data:HomeData={viewerId:actor.id,family:{id:view.household.id,name:view.household.name,houseStage:1,members:view.members.map((m,i)=>({...m,tone:tones[i%4],avatar:{face:'smile',accessory:'none'}}))},schedules:view.schedules.filter(s=>dayKey.format(new Date(s.start))===today).map(s=>({id:s.id,title:s.title,startsAt:s.start,memberIds:s.participantIds})),chores:[],memories:[],notifications:[]};
 return <HomeScreen data={data} live />;
}
