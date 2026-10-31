import { Suspense } from 'react';
import { RelationshipScreen } from '@/src/features/relationship';
export default function HeartPage(){return <Suspense fallback={<p>불러오는 중…</p>}><RelationshipScreen /></Suspense>;}
