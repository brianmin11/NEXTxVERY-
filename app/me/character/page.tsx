import type { Metadata } from "next"

import { CharacterEditorScreen } from "@/components/character/character-editor-screen"

export const metadata: Metadata = { title: "내 캐릭터" }

// 프론트 데모: 본인 캐릭터·이름만 메모리 상태에서 바꾼다. 실제 저장은 없다.
export default async function MyCharacterPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams
  const returnTo = from === "home" ? "/home" : "/more"
  return <CharacterEditorScreen returnTo={returnTo} />
}
