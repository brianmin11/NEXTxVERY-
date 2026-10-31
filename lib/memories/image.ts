import { MEMORY_ACCEPT_LABEL, MEMORY_ACCEPT_MIME, MEMORY_MAX_BYTES, MEMORY_MAX_LABEL } from "./config"
import type { ImageInspectResult } from "./types"

/**
 * 선택한 파일을 확인한다: MIME → 용량 → 브라우저 디코딩 순서.
 * 확장자만 보지 않는다. 다만 브라우저가 주는 MIME도 확장자 기반일 수 있으므로
 * 디코딩 성공까지 확인하고, 그래도 서버 측 검증을 대신하지 않는다.
 * 성공하면 object URL을 만들어 돌려준다. 호출한 쪽이 더 이상 쓰지 않을 때 revoke 해야 한다.
 */
export async function inspectImageFile(file: File): Promise<ImageInspectResult> {
  const mime = file.type
  if (!(MEMORY_ACCEPT_MIME as readonly string[]).includes(mime)) {
    const shown = describeFormat(file)
    return {
      ok: false,
      reason: "unsupported",
      message: `${shown} 형식은 아직 지원하지 않아요. ${MEMORY_ACCEPT_LABEL} 사진을 골라 주세요.`,
    }
  }
  if (file.size > MEMORY_MAX_BYTES) {
    return {
      ok: false,
      reason: "too-large",
      message: `사진이 ${formatMiB(file.size)}라서 올릴 수 없어요. ${MEMORY_MAX_LABEL} 이하만 가능해요(임시 제한).`,
    }
  }
  const objectUrl = URL.createObjectURL(file)
  try {
    const { width, height } = await decode(objectUrl)
    if (!width || !height) throw new Error("empty")
    return { ok: true, objectUrl, mime, width, height, bytes: file.size }
  } catch {
    URL.revokeObjectURL(objectUrl)
    return {
      ok: false,
      reason: "corrupted",
      message: "사진을 읽을 수 없어요. 파일이 손상됐거나 이미지가 아닐 수 있어요. 다른 사진을 골라 주세요.",
    }
  }
}

function decode(url: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error("decode"))
    img.src = url
  })
}

function describeFormat(file: File) {
  const ext = file.name.includes(".") ? file.name.split(".").pop()?.toUpperCase() : ""
  if (ext === "GIF") return "GIF"
  if (ext === "SVG") return "SVG"
  if (ext === "HEIC" || ext === "HEIF") return "HEIC"
  if (file.type) return file.type.replace("image/", "").toUpperCase()
  return ext || "이"
}

function formatMiB(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export function revokeIfBlob(url: string | null | undefined) {
  if (url && url.startsWith("blob:")) URL.revokeObjectURL(url)
}
