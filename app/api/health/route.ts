import { getDatabase } from "@/src/lib/server/auth"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export function GET() {
  try {
    getDatabase().prepare("SELECT 1").get()
    return Response.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch {
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    )
  }
}
