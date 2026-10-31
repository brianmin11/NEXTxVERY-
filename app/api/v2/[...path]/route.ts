import { getActor, getDatabase } from "@/src/lib/server/auth"
import { createV2Service } from "@/src/lib/server/v2-service"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const privateHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
}
async function limitedBody(request: Request, max: number) {
  const reader = request.body?.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.length
      if (length > max) {
        await reader.cancel()
        throw Object.assign(new Error("파일 또는 입력 크기를 줄여 주세요."), {
          status: 413,
          code: "TOO_LARGE",
        })
      }
      chunks.push(value)
    }
  }
  return Buffer.concat(chunks)
}
async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    if (request.method !== "GET") {
      const origin = new URL(
        process.env.BETTER_AUTH_URL || "http://localhost:3120"
      ).origin
      if (request.headers.get("origin") !== origin)
        return Response.json(
          {
            error: {
              code: "ORIGIN_REJECTED",
              message: "허용되지 않은 요청이에요.",
            },
          },
          { status: 403, headers: privateHeaders }
        )
    }
    const actor = await getActor(request.headers)
    if (!actor)
      return Response.json(
        { error: { code: "UNAUTHENTICATED", message: "로그인이 필요해요." } },
        { status: 401, headers: privateHeaders }
      )
    const path = (await context.params).path.join("/")
    const service = createV2Service({ db: getDatabase() })
    if (request.method === "POST" && path === "memories/assets") {
      await service.cleanup()
      const buffer = await limitedBody(request, 11 * 1024 * 1024)
      const form = await new Response(buffer, {
        headers: { "Content-Type": request.headers.get("content-type") || "" },
      }).formData()
      const file = form.get("file")
      if (!(file instanceof File))
        return Response.json(
          {
            error: { code: "INPUT_INVALID", message: "사진을 선택해 주세요." },
          },
          { status: 422, headers: privateHeaders }
        )
      return Response.json(
        {
          data: await service.upload(
            actor,
            new Uint8Array(await file.arrayBuffer()),
            file.type
          ),
        },
        { status: 201, headers: privateHeaders }
      )
    }
    const match = path.match(/^memories\/assets\/([^/]+)\/content$/)
    if (request.method === "GET" && match) {
      const asset = await service.content(actor, match[1])
      return new Response(new Uint8Array(asset.bytes), {
        headers: { ...privateHeaders, "Content-Type": asset.mime },
      })
    }
    let body: unknown = undefined
    if (request.method !== "GET") {
      const raw = await limitedBody(request, 32768)
      try {
        body = raw.length ? JSON.parse(raw.toString("utf8")) : {}
      } catch {
        return Response.json(
          {
            error: {
              code: "INPUT_INVALID",
              message: "입력 형식을 확인해 주세요.",
            },
          },
          { status: 422, headers: privateHeaders }
        )
      }
    }
    return Response.json(
      { data: await service.request(actor, request.method, path, body) },
      { headers: privateHeaders }
    )
  } catch (error) {
    const e = error as { status?: number; code?: string; message?: string }
    const known =
      typeof e.status === "number" &&
      e.status >= 400 &&
      e.status <= 599 &&
      typeof e.code === "string"
    return Response.json(
      {
        error: {
          code: known ? e.code : "SERVER_ERROR",
          message: known
            ? e.message
            : "요청을 완료하지 못했어요. 다시 시도해 주세요.",
        },
      },
      { status: known ? e.status : 503, headers: privateHeaders }
    )
  }
}
export {
  handle as GET,
  handle as POST,
  handle as PATCH,
  handle as PUT,
  handle as DELETE,
}
