/**
 * 추억 사진 임시 프론트 제한. 백엔드 확정값이 아니며 UI 안내·검증이 같은 값을 쓴다.
 * 프론트 검증은 서버 보안 검증(MIME 스니핑·재인코딩·용량 정책)을 대신하지 않는다.
 */
export const MEMORY_MAX_BYTES = 10 * 1024 * 1024
export const MEMORY_MAX_LABEL = "10MB"
export const MEMORY_ACCEPT_MIME = ["image/jpeg", "image/png", "image/webp"] as const
export const MEMORY_ACCEPT_ATTR = MEMORY_ACCEPT_MIME.join(",")
export const MEMORY_ACCEPT_LABEL = "JPEG · PNG · WebP"
export const MEMORY_CAPTION_MAX = 200
/** 홈 '최근 추억'에 보여줄 개수 */
export const HOME_MEMORY_LIMIT = 3
