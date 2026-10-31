# 운영 인증·AI 병렬 작업 계약

2026-11-01 사용자 요청: 같은 해커톤 프로젝트에 인증 작업 세션을 추가하고, 기존 세션에서 AI 운영 설정을 병렬 진행한다. 디자인은 별도 개발자 담당.

## 인증 세션 (3번)

독립 auth-v5 worktree에서 운영 cookie/session 설정, 가입·재로그인·만료·복구를 구현·검증한다. 이메일 인증/비밀번호 재설정은 제품 범위와 발송업체/도메인이 확인되기 전 기본 비활성화하고 테스트 메일 어댑터로 검증한다. 실제 발송/도메인변경/유료플랜은 별도 구체적 승인 없이 실행하지 않는다.
소유: src/lib/server/auth.ts, src/lib/server/auth-*.ts, tests/v5-auth*.test.ts. API 작업은 api worktree, 테스트는 qa worktree로 분리하고 기존 worktrees 도구 소유권 검사 후 커밋을 메인에 반환한다. 필요한 UI 변경은 디자인 개발자와 충돌하지 않도록 별도 제안하며 임의 재설계하지 않는다.

## 현재 세션 (4번)

src/lib/server/provider.ts, 새 AI policy/ledger 모듈, AI 관련 migration·환경 템플릿·복구 allowlist·테스트를 담당한다. 현재 로컬 SQLite의 승인된 합성 평가 예산원장을 삭제·초기화하지 않는다. 운영 예산은 PostgreSQL 별도 테이블로 관리하고 여러 프로세스의 예약·횟수·동시성 제한을 원자적으로 처리한다. 입력 원문/AI 초안/그 해시는 원장에 넣지 않는다.
운영 모드는 명시 설정 전 비활성화. 일반 로그인 계정용 정책을 구현하되 실제 사용자 입력의 외부 전송과 유료 호출은 한도·데이터·모델·대상이 확정된 후 승인받아 활성화한다. 단위/통합 테스트는 가짜 provider로 우선 진행한다.

## 공통 경계

기존 getActor(headers) -> {id,name,email}|null 계약, Better Auth 사용자 ID와 family membership을 유지한다. AI 권한은 서버에서 얻은 actor.id를 기준으로 검사하며 클라이언트 제공 actor ID는 신뢰하지 않는다. 인증 세션은 provider/AI 예산/migration/공통 의존성/환경파일을 수정하지 않는다. 메인은 인증 소유 파일을 수정하지 않는다. 공통 변경 필요 시 메시지로 조율하고 통합 담당이 적용한다. 비밀파일을 worktree에 복사하지 않는다.

완료는 각 독립 검사 후 통합 후보에서 로그인→AI권한→사용량예약→성공/한도/시간초과/장애→원문비보관을 확인해야 한다. 도메인·메일 실제 발송·유료 모델·공개 배포 미검증은 별도로 명시한다.

## 시작 기록

인증 세션: `우리집 운영 인증 보완 · 3번`, thread `01a19339-30ba-71b2-a6c5-f0fd5af5f958`, host local, 동일 해커톤 프로젝트. active/inProgress 확인.
기준 SHA: f1d95c103074592551e36459cedbf491beae1e2a. auth-v5/api와 auth-v5/qa worktree 사용.
AI 코드 점검: provider.ts의 SQLite reservations/v3_ai_rate 및 synthetic allowlist가 운영 전환 대상. 기존 RunOptions의 자동재시도0·일시입력 store:false는 유지해야 한다. 새 운영 한도는 사용자 선택 대기이며, 미설정 기본값은 비활성화로 진행한다.
이 기록은 병렬 작업 시작 기록이며 3·4번 구현 완료를 의미하지 않는다.
