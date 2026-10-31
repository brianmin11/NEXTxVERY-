# 서비스 백엔드 연결 현황

2026-11-01. 기준 프론트 `민경민` a5e474a, 작업 브랜치 `codex/frontend-backend-v2`. 외형 개편 없이 실제 서비스 흐름의 빈 부분을 연결했다.

## 제공하는 흐름

- 이메일/비밀번호 가입·로그인·로그아웃, 서버 세션, 가족 생성·초대·가입.
- 가족 일정 CRUD, 작성자 권한, 날짜/시간 검증, revision 충돌, 중복 요청 방지.
- 집안일 CRUD와 담당자/작성자의 완료·되돌리기, 홈 요약.
- 마음 자유 입력 → 명시적 AI 제안 → 사용자가 최종 확인 → 메시지 전달·읽음·응답. 개인 원문과 미승인 AI 초안은 서버 메모리에서만 처리한다.
- 비공개 사진 업로드·재인코딩·게시·조회·삭제. 연결되지 않은 업로드 TTL 및 중단된 업로드의 오래된 고아 파일 정리.
- **더보기 → 함께 일정 조율**: 작성자의 기존 시간 지정 일정 선택 → 각자 공유할 의견 확정 → AI 또는 직접 제안 → 같은 제안을 전원 수락 → 작성자가 기존 일정을 원자적으로 변경.
- 조율 수정은 이전 수락을 초기화한다. 보류/거절/철회/만료/일정 변경/구성원 변경은 실행을 막는다. 반영 후 철회는 이미 저장된 일정을 자동 되돌리지 않는다.
- 조율 AI는 사용자가 공유를 확정한 의견과 해당 일정만 받는다. 개인 메모, 다른 메시지, 관련 없는 일정은 입력하지 않는다. AI 초안 생성과 제안 공유는 별도 작업이다.
- 한 번에 하루 안의 기존 시간 지정 일정 1건의 날짜·시각만 변경한다. 반복/담당/알림/여러 작업/미확인 조건은 표시하고 자동 실행하지 않는다. 종일 일정은 기존 달력에서 직접 관리한다.

## 저장과 호출 경계

`src/lib/server/provider.ts`는 Responses API를 `store:false`, 자동 재시도 0회로 호출한다. 서버 DB/요청 영수증/로그에는 원문과 AI 초안을 저장하지 않는다. 비용 영수증은 호출 메타데이터만 보관한다. 공동 조율의 멱등 영수증은 조율 ID만 저장하여 철회된 의견이 과거 응답으로 재노출되지 않게 한다.

앱 서버 비보관은 외부 제공자의 완전 무보관 보장이 아니다. OpenAI의 abuse monitoring·prompt cache 등은 계정 정책에 따른다. 확인한 공식 자료: [Data controls](https://developers.openai.com/api/docs/guides/your-data), [API pricing](https://platform.openai.com/pricing).

유료 모델은 기존 합성 검증 승인만 사용했다. 기본 비활성화이며, 활성화에는 기존 절대 경로 예산 원장과 명시적 합성 계정 ID allowlist가 모두 필요하다. 개인의 실제 민감한 입력을 기존 테스트 승인으로 처리하지 않는다. 누적 원장을 새로 만들어 한도를 우회하지 않는다. 한도 소진/모델 장애 시 직접 작성 흐름은 계속 가능하다.

## 실행과 복구

Node24.15 이상, `npm ci`, `npm run typecheck`, `npm run build`, `npm run local -- --production`. `.env.example`의 인증 secret/base URL/DB/사진 경로를 `.env.local`에 설정한다. 실제 키는 기존 비공개 파일을 `OPENAI_KEY_ENV_FILE`로 참조하고 복사·커밋하지 않는다.

- DB: `FAMILY_DB_PATH` (기본 `.data/family.sqlite`), SQLite WAL.
- 사진: `FAMILY_UPLOAD_PATH` (기본 `.data/uploads`), 공개 정적 경로 없음.
- 상태: `GET /api/health`는 민감한 설정 없이 성공/실패만 반환한다.
- 업로드 정리: `node --import tsx scripts/cleanup-assets.ts`.
- 백업: `node scripts/data-snapshot.mjs backup .data/backup-YYYYMMDD-HHMM`.
- 복구: `node scripts/data-snapshot.mjs restore .data/backup-YYYYMMDD-HHMM .data/recovered-YYYYMMDD-HHMM`.

백업은 업무 쓰기 잠금을 잡은 동안 SQLite snapshot과 참조하는 사진을 함께 복사하고 SHA256 manifest를 남긴다. 복구는 무결성·체크섬·사진 누락을 검사하고 **새 경로에만** 쓴다. 기존 DB를 덮어쓰지 않는다. 복구 DB와 uploads를 환경변수에 함께 지정하여 서버를 재시작한다. 인증 secret은 별도 비밀 저장소에서 동일하게 유지한다. 실패한 `.partial` 디렉터리는 성공 백업으로 취급하지 않는다.

## 배포와 범위

검증 대상은 localhost의 실제 production build, 실제 Better Auth 계정과 영속 SQLite/비공개 파일이다. 계정·입력은 합성 검증 자료이며 인증이나 DB를 mock으로 대체하지 않았다. 이는 외부 운영 DB/RLS/운영 도메인/공개 배포 검증과 다르다. Vercel의 임시 파일시스템으로 잘못 배포되지 않도록 기존 차단을 유지했다.

외부 영속 DB·비공개 object storage 프로비저닝, 운영 AI 예산·계정 정책, 공개 배포는 미실행이다. 별도 서비스/비용/공개 범위 결정이 필요하며 현재 완료로 표시하지 않는다. 최신 프론트에서 준비 중인 가족·알림 설정, 이메일 인증/재설정 발송, 반복/여러 날 조율과 외부 푸시는 이번 계약 범위에 추가하지 않았다.

실제 검사 결과와 후보 SHA는 `evidence/VERIFICATION-V3.txt`에 기록한다. `scripts/verify-v3-live.mjs`는 명시적 prepare/live/check 단계로 합성 호출을 수행하며 실패를 자동 재시도하지 않는다.
