# Codex 작업 통합 범위 — 2026-11-01

대상: brianmin11/NEXTxVERY-의 민경민 브랜치. 이 PR은 검토 요청이며 직접 병합/배포하지 않는다.

## 포함
- codex/frontend-backend-v2 8c2eeea: 최신 프론트 연결, 가족 권한/일정/집안일/메시지/사진, Relationship AI와 공동 조율, PostgreSQL/private Storage 및 백업복구, 운영 AI 예산원장.
- auth-v5-api 183f658 및 auth-v5-qa 9c00e3c: 운영 인증, 선택적 이메일 인증/재설정, 단일 수신자 Resend 테스트 전송 및 회귀.
- 이전 relationship-ai/relationship-integration-work 브랜치 감사 결과 누락된 identity-contract 테스트 및 평가 증거 9개 복원. 구버전 UI/API는 최신 기능으로 대체되어 복원하지 않는다. rai-core/eval-recovery/integration-v2 작업은 후속 패키지/서비스에 반영되어 있다.

## 검증
통합 후보에서 typecheck, lint, production build, tests/*.test.ts 서버 회귀 및 엔진 테스트92개 통과. 기존 metadataBase 경고 있음. 이번 PR 준비에서 브라우저 E2E/원격 DB/배포 재검증은 수행하지 않았다.
복원한 평가 증거는 과거 ko-relationship-4 합성평가이며 현재 프롬프트의 새 실모델 평가가 아니다.

## 운영 상태
.env/실제 키/로컬 DB는 제외. 운영 AI 및 이메일은 명시 설정 전 비활성이다.
Resend 테스트는 onboarding@resend.dev와 지정 수신자 1개만 허용하며 Vercel 기본 도메인으로 제한이 해제되지 않는다. 현재 프로필은 자동 복사하지 않는다. 메일 API 수락은 실제 수신함 도착 증거와 구분한다.
인증/재설정 화면 연결, 실제 발신 도메인, 공개배포는 완료로 주장하지 않는다.
