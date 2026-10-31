import type { Metadata } from "next"
import { CoordinationScreen } from "@/src/features/live/coordination-screen"
export const metadata: Metadata = { title: "함께 일정 조율" }
export default function CoordinationPage() {
  return <CoordinationScreen />
}
