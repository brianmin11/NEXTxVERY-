/**
 * Vercel 요청 한도 안에 multipart 본문까지 들어가도록 사진을 4MiB로 제한한다.
 * 프론트 검증은 서버 보안 검증(MIME 스니핑·재인코딩·용량 정책)을 대신하지 않는다.
 */
export const MEMORY_MAX_BYTES = 4 * 1024 * 1024
export const MEMORY_MAX_LABEL = "4MB"
export const MEMORY_ACCEPT_MIME = ["image/jpeg", "image/png", "image/webp"] as const
export const MEMORY_ACCEPT_ATTR = MEMORY_ACCEPT_MIME.join(",")
export const MEMORY_ACCEPT_LABEL = "JPEG · PNG · WebP"
export const MEMORY_CAPTION_MAX = 200
/** 홈 '최근 추억'에 보여줄 개수 */
export const HOME_MEMORY_LIMIT = 3
