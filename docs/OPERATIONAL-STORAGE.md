# 제품 저장소 v4 — 실행·백업·복구

2026-11-01, 구현 후보 `a514575`. 새 Supabase `woorijip-production` (`pjpskzlihmakcgjffdiq`), 서울, Free/Nano. 기존 연습 프로젝트는 사용하지 않았다. 프론트 디자인은 변경하지 않았다.

## 실제 적용 범위

- Better Auth와 서비스 데이터를 PostgreSQL의 비공개 `woorijip` 스키마에 저장한다. Data API 비활성화, anon/authenticated 스키마 접근 금지. Better Auth 세션을 사용하므로 Supabase JWT `auth.uid()` 기반 가족 RLS로 설명하지 않는다. 가족별 권한은 서버 API에서 검사하며 직접 브라우저 DB 접근은 차단한다.
- `family-memories`는 비공개 WebP bucket이다. 클라이언트는 service-role 키나 공개 사진 URL을 받지 않는다. 사진 조회는 로그인·소유권·가족 권한을 검사하는 API를 통한다.
- 사용자 별도 이관 승인 후 기존 22개 계정, 13개 가족, 현재 서비스 레코드, 사진 2개를 이관했다. 기존 비밀번호 로그인 및 두 계정의 이전 일정·공동 조율 결과를 확인했다. 이관 allowlist 외 legacy 개인 원문 테이블은 전송하지 않았다.
- 자유 입력 원문과 미승인 AI 초안 비보관 정책 유지. 이번 단계에서는 `INTEGRATION_LIVE_APPROVED=false`; 새 유료 모델 호출 없음.
- 로컬 제품 서버가 원격 저장소에 연결된 상태다. 공개 호스팅 배포 완료를 의미하지 않는다.

## 실행

비밀정보는 Git 제외 `.env.supabase.local`에만 보관하며 mode 0600이다. 공식 Supabase CA를 `DATABASE_SSL_CA`에 넣고 인증서 검증을 유지한다. 연결은 dashboard에서 확인한 Session pooler, port 5432다. 복구 maintenance는 transaction pooler 6543을 거부한다.

```sh
npm run build
STORAGE_ENV_FILE=.env.supabase.local npm run local -- --production
```

현재 로컬 `.env.local`에도 `STORAGE_ENV_FILE=.env.supabase.local`이 선택되어 있어 `npm run local -- --production`이 제품 저장소를 사용한다. 프로필 로딩은 이 실행기에서 수행하므로 `next start`를 직접 사용하지 않는다. 운영 배포 시에는 각 프로필의 값을 호스팅 secret store에 직접 설정해야 한다.

선택한 프로필은 `.env.local`/상속된 환경변수보다 우선한다. 복구 프로필은 DB URL/CA/Storage 키와 함께 `DATABASE_SCHEMA=woorijip_recovery`, `SUPABASE_STORAGE_BUCKET=family-memories-recovery`를 지정한다. production 프로필에는 `DATABASE_SCHEMA=woorijip`을 명시했다.

프로비저닝/cleanup 명령:

```sh
STORAGE_ENV_FILE=.env.supabase.local node --import tsx scripts/migrate-postgres.ts --apply
STORAGE_ENV_FILE=.env.supabase.local node --import tsx scripts/setup-private-storage.ts --apply
STORAGE_ENV_FILE=.env.supabase.local node --import tsx scripts/cleanup-assets.ts
```

migration은 기존 테이블을 지우지 않는다. 설정을 바꿀 때는 구체적인 대상·계정·비용 승인 범위를 확인한다. 신규 public bucket으로 대체하지 않는다.

## 백업과 복원

```sh
# 새 경로를 사용한다. 백업에는 비밀번호 해시와 세션도 포함되므로 외부 공유 금지.
STORAGE_ENV_FILE=.env.supabase.local node --import tsx scripts/storage-snapshot.ts backup .data/new-backup
# 미리 migration한 빈 복구 스키마와 별도 private bucket을 지정한 프로필만 사용.
STORAGE_ENV_FILE=.env.supabase-recovery.local node --import tsx scripts/storage-snapshot.ts restore .data/new-backup --apply
```

백업은 업무 쓰기 lock을 유지한 채 repeatable-read로 허용된 테이블과 참조 사진을 읽는다. 이 동안 쓰기가 대기/실패할 수 있으므로 점검 시간에 실행한다. auth 데이터는 같은 DB snapshot 시점 기준이다. 객체는 불변 UUID 키로 저장하고, SHA-256을 확인한다. `.data` 디렉터리/백업 파일은 0700/0600이며 Git 제외다. `.partial` 폴더 또는 manifest 없는 폴더는 완료된 백업이 아니다.

복구는 기존 데이터 덮어쓰기를 거부한다. 데이터 테이블이 모두 비어 있어야 하며, 마지막 검사부터 commit까지 인증 테이블도 잠근다. 사진 업로드 후 DB를 원자적으로 반영한다. 중간 실패 후 재실행 시 기존 객체는 동일 checksum일 때만 재사용한다. 성공한 같은 snapshot 재적용은 거부한다. 복구 프로필은 원래 서비스와 분리하여 검증한 후 사람이 운영 전환 대상을 정한다.

이번 실제 산출물(비공개 로컬): `.data/snapshot-v4-source` → `.data/bundle-v4-import` → 제품 DB. 제품 백업 `.data/bundle-v4-remote` → `woorijip_recovery` + `family-memories-recovery`에 복원했다. 복구 데이터에는 추가 합성 테스트 계정 포함 25개 계정·15개 가족·사진 3개가 있다. 복구 검증 서버는 종료했고 기본 서버 localhost3120만 유지했다.

자동 백업 주기·오프사이트 보관·PITR 설정은 이번 수동 복구 검증에 포함되지 않는다. 새 기능으로 테이블/인증 필드가 추가되면 snapshot allowlist와 migration도 함께 갱신해야 한다.

## 검증과 제한

- 타입 검사·lint·production build 통과. 서비스/provider/복구/Storage 로컬 회귀 28/28 통과. QA가 통합 후보를 읽기 전용으로 재검증했다.
- 원격 API: 기존 비밀번호 로그인, 신규 합성 계정 가입, 가족 초대/가입, 두 서버 동일 requestId 중복 방지, 동일 revision 경쟁 시 하나 성공/하나409.
- 실제 Storage: 합성 PNG→WebP 업로드, 공유 전 본인만 접근, 공유 후 가족 조회, 다른 가족404·비로그인401, 공개 URL 차단. 재시작 및 복구 서버에서 사진 checksum 일치.
- anon/authenticated 직접 DB SELECT 거부, 원문 marker 비보관 확인.
- 브라우저: 실제 로그인→자유 입력 일정 저장→새로고침 유지. DB에 정확히1개 저장 및 다른 가족 계정 조회 확인. 증거 `evidence/storage-v4-calendar.png`.
- 연결 준비 중 간헐적 timeout/503을 관찰했다. 입력은 화면에 보존됐고 재시도로 저장됐다. pool max2, keepalive, 연결/쿼리 시간 제한, idle 오류 처리 적용 후 기본/복구 서버 재조회와 최종 화면 저장 통과. 장시간 가용성/부하 검증까지 완료한 것은 아니다.
- 기존 v3의 실모델 성공 기록은 이전 승인으로 수행한 결과다. 이번 원격 저장소 검증을 새 실모델 성공으로 표시하지 않는다. 운영 AI 예산 중앙화/실제 사용자 처리 정책과 공개 배포는 후속 단계다.
