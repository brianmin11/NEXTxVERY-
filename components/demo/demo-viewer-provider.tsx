"use client"

// 데모 인물 전환 훅. 가족·인물 상태의 원본은 components/family/family-provider.tsx 하나이며
// 기존 화면이 쓰던 이름(useDemoViewer)을 그대로 두기 위한 얇은 별칭이다.
export { FamilyProvider as DemoViewerProvider, useFamily as useDemoViewer } from "@/components/family/family-provider"
