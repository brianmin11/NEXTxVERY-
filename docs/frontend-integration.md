# 프론트엔드 연동 문서 (통합 상태)

- **코드 기준:** 브랜치 `integration/figma-backend`. 프론트 기준 `민경민` `3b906061fc4fcd4f3ca9958c46b2f0ad635e12bc`(Figma 모듈 A~F)에 백엔드 `origin/codex/all-work-pr-20261101` `52b63f59c8f91cc11741f4e0de88eb3fadd94a61`를 merge하고 연결했다.
- **현재 상태:** 기본 모드는 **live**다. Better Auth 이메일/비밀번호 세션, `/api/v2/*`(가족·초대·일정·집안일·마음·사진·조율), 로컬 SQLite + 비공개 파일 저장(또는 Supabase PostgreSQL + 비공개 Storage)에 실제로 연결돼 있다. `NEXT_PUBLIC_APP_MODE=demo`로 띄우면 예전 메모리 데모(데모 인물 전환·고정 초대코드·seed)만 쓴다.
- **아직 아닌 것:** 실제 AI 제안(`AI_MODE`·키·승인 없으면 503으로 "직접 작성"만 가능), 이메일 인증·비밀번호 재설정 화면, 푸시 알림, 공개 배포. 자세한 것은 8장.

## 변경 요약 (프론트 `3b90606` 기준 대비)

| 구분 | 바뀐 것 |
|---|---|
| 모드 | `lib/app-mode.ts` `APP_MODE`(`live` 기본 / `demo`). 화면·훅 인터페이스는 같고 provider 구현만 바뀐다 |
| 가족·세션 | `components/family/family-context.ts`에 `FamilyContextValue`(가족 안)와 `OnboardingContextValue`(가족 밖) 분리. 구현은 `demo-family-provider.tsx`(메모리) / `live-session.tsx`(세션·API). `family-provider.tsx`가 모드로 선택 |
| 게이트 | `FamilyScope`: live에서 세션 상태에 따라 `/login`·`/welcome`로 보내고, 가족이 있을 때만 기능 provider를 가족 id로 마운트 |
| 기능 provider | `components/{calendar,chores,memories,mind}/*-context.ts`(공용 모양) + `memory-*-provider.tsx`(데모) + `src/features/live/*-provider.tsx`(서버). 변경 함수는 모두 `Promise`를 돌려주고 화면은 결과를 기다린 뒤 이동한다 |
| 서버 확장 | `src/lib/server/v2-service.ts`: 세션에 `adminMemberId`·`theme`·구성원 `avatar` 포함, `PUT family/settings`(관리자: 이름·테마), `PUT me/profile`(본인: 이름·캐릭터), `family/invites`는 관리자만, 초대 응답에 `expiresAt`. 저장은 기존 `v2_records`(kind `family-settings`, `profile`)를 쓰므로 **migration 추가 없음** |
| 타입 | `Family.inviteCode`는 선택(라이브는 세션에 코드를 넣지 않음). `CalendarEvent`·`Chore`·`MindMessage`·`MemoryPost`에 `revision?`, `MemoryAsset`에 `kind: "remote"`(백엔드 추가분) |
| 라우트 | `/login`(이메일/비밀번호, 계정 만들기), `/coordination`(백엔드의 함께 일정 조율, 더보기에서 진입). 나머지는 프론트 기준 그대로 |
| 제거 | 백엔드가 만든 옛 UI 복사본 `src/features/live/*-screen.tsx`·`session.tsx`(Figma 화면으로 대체), 백엔드의 `components/*` 재지정 stub |

## 0. 실행 방법

```sh
npm ci                      # workspaces: packages/relationship-ai 포함
cp .env.example .env.local  # 값은 아래 표. 실제 키는 넣지 않는다
npm run local               # dev, http://127.0.0.1:3100 (webpack, .env.local 로드)
npm run build && npm run local -- --production   # production
NEXT_PUBLIC_APP_MODE=demo npx next dev -p 3200   # 메모리 데모만 보기
```

| 환경변수 | 용도 | 로컬 값 예 |
|---|---|---|
| `BETTER_AUTH_SECRET` | 세션 서명·초대코드 HMAC(32자 이상) | 무작위 문자열 |
| `BETTER_AUTH_URL` | 허용 origin(쓰기 요청의 `Origin` 검사). 접속 주소·포트와 정확히 같아야 한다 | `http://127.0.0.1:3100` |
| `PORT` | 서버 포트(`.env.example` 기본은 3120, 이 문서의 예는 3100) | `3100` |
| `FAMILY_DB_PATH` / `FAMILY_UPLOAD_PATH` | 로컬 SQLite·사진 경로(`.data/`, git 제외) | 기본값 |
| `DATABASE_URL`, `DATABASE_SCHEMA`, `DATABASE_SSL_CA`, `STORAGE_BACKEND`, `SUPABASE_*` | 운영 저장소(선택). `docs/OPERATIONAL-STORAGE.md` | 비공개 프로필 파일 |
| `AI_MODE`, `AI_LIVE_APPROVED`, `OPENAI_KEY_ENV_FILE`, `INTEGRATION_*` | AI 활성화(선택). `docs/OPERATIONAL-AI.md` | 비활성 |
| `NEXT_PUBLIC_APP_MODE` | 비우면 live, `demo`면 메모리 데모 | 비움 |

DB 준비: 로컬 SQLite는 첫 실행 때 `migrations/001-host.sql`·`002-v2.sql`을 자동 적용한다(`src/lib/server/database.ts`). PostgreSQL은 `scripts/migrate-postgres.ts --apply`(대상이 개발용인지 먼저 확인). 이번 통합은 **로컬 SQLite만** 실행했고 운영 DB·Storage·AI 비용 발생 명령은 실행하지 않았다.

## 1. 가족·구성원·현재 사용자·권한

| 구분 | 현재 코드 |
|---|---|
| 세션 | `GET /api/v2/session` → `{ viewer: { id, name }, family: Family \| null }`. `Family = { id, name, adminMemberId, theme, members[{ id, name, tone, avatar }] }`. `tone`은 서버가 순서대로 배정(표시 전용) |
| 가족 만들기 | `POST /api/v2/families { name, requestId }` → 만든 사람이 `family-settings.adminMemberId`. 이어서 `PUT me/profile`로 이름·캐릭터 저장(`createFamily`가 두 호출을 묶음) |
| 참여 | `POST /api/v2/family/join { inviteCode, requestId }` → `PUT me/profile`. 코드 미리 조회 API는 없어 live에서는 코드 → 내 캐릭터 → 참여 요청 순서이며 잘못된 코드는 마지막 단계에서 `INVITE_INVALID`로 안내한다(`JoinFamilyScreen`) |
| 초대 발급 | `POST /api/v2/family/invites { requestId }` → `{ inviteCode, expiresAt }`(24시간, 해시 저장). **관리자만**(403 FORBIDDEN) |
| 테마·가족 이름 | `PUT /api/v2/family/settings { theme?, name?, requestId }` **관리자만**. 다른 레코드는 건드리지 않는다 |
| 내 캐릭터·이름 | `PUT /api/v2/me/profile { name?, avatar?, requestId }` 본인만. `avatar`는 `isValidCharacter`로 카탈로그 검증 |
| 프론트 권한 | `lib/family/permissions.ts`는 UI 숨김용이고 서버가 같은 규칙을 다시 검사한다(검증: 일반 구성원의 settings PUT·invites POST → 403) |
| 데모 전환 | `DemoViewerSwitch`·`/more` 프로토타입 제어는 `IS_DEMO`일 때만 렌더된다. live에는 로그아웃만 있다 |

**세션 흐름:** `LiveFamilyProvider`가 마운트·탭 복귀·`session-expired` 이벤트 때 세션을 다시 읽는다. 401이면 `/login`, 가족이 없으면 `/welcome`(온보딩 경로만 허용), 가족이 있으면 `FeatureProviders key={family.id}`. 로그아웃·가족 참여·재로그인은 모두 세션 재조회로 반영되고 이전 가족 데이터는 provider 재마운트로 사라진다. 브라우저에 토큰을 저장하지 않는다.

**미구현:** 이메일 인증·비밀번호 재설정 화면(백엔드 Resend 테스트 전송 설정은 `docs/CODEX-PR-SCOPE.md`), 가족 탈퇴·관리자 이전, 한 사용자 여러 가족.

## 2. 마음 전하기·수신함·AI

| 구분 | 현재 코드 |
|---|---|
| 목록·전송 | `GET/POST /api/v2/mind/messages`(`{ text, recipientMemberId, requestId }`). 전송은 확인 단계 버튼에서 `confirmToken`을 `requestId`로 보내 서버가 같은 요청을 한 번만 처리한다. 실패하면 잠금을 풀고 같은 토큰으로 재시도(중복 생성 없음) |
| 읽음 | `PUT /api/v2/mind/messages/:id/read` — `MindDetailScreen` 진입 시 수신자이고 `status === "sent"`일 때만 호출(목록 클릭·URL 직접 진입 동일). 보낸 사람 조회는 호출하지 않음 |
| 응답 | `PUT …/:id/response { response, expectedRevision }` 수신자만, 1회. 답장 본문 ≤300 |
| AI 제안 | `POST /api/v2/mind/suggestions { rawText, recipientMemberId, clientDraftVersion }` — 'AI 제안 받기' 버튼에서만 호출. 원문·수신자를 바꾸면 `version`이 올라가 늦은 응답을 버리고 전달 문장을 비운다. 결과는 편집 가능한 초안으로만 들어가며 라벨 "AI 제안 · 보내기 전 확인해 주세요"를 붙인다. 서버는 원문·초안을 저장하지 않는다(`provider.ts`: `store:false`, 재시도 0) |
| AI 비활성 | 키·승인이 없으면 503 `AI_UNAVAILABLE` → `AdapterStatus error` + 직접 작성 안내(검증됨). 실제 호출은 `AI_MODE`·`AI_LIVE_APPROVED`·예산 원장 설정과 비용 승인이 필요하다 |

원문·초안은 브라우저 메모리에만 있고 전송 후 지운다. 공용 응답·알림·URL·로그에 넣지 않는다. 관리자도 타인의 초안을 읽을 경로가 없다(서버에 저장되지 않음).

## 3. 캘린더

- `GET/POST /api/v2/calendar/events`, `PATCH/DELETE …/:id`(`expectedRevision`). 날짜 `YYYY-MM-DD`·시간 `HH:mm` 문자열 그대로 저장(서버 `calendarFields` 검증, UTC 변환 없음). 작성자만 수정·삭제(서버 403).
- 홈 '오늘 일정'과 `/calendar`는 같은 `useCalendar()`를 읽으므로 생성·수정·삭제 뒤 `refresh`로 둘 다 갱신된다(검증: A가 만든 종일 일정을 B 홈에서 확인).
- 충돌: 다른 revision으로 수정하면 409 → `useResource.mutate`가 다시 불러오고 "내용이 변경됐어요" 안내.

## 4. 추억 사진

- 업로드 `POST /api/v2/memories/assets`(multipart `file`, 11MiB 한도): 서버가 MIME·실제 포맷·픽셀 수를 검사하고 WebP로 재인코딩·회전 정규화 후 pending 자산으로 둔다. 게시물 `POST /api/v2/memories { fields: { memoryDate, caption, assetId } }`가 자산을 attached로 바꾼다. 조회는 `/api/v2/memories/assets/:id/content`(로그인·가족 검사, `no-store`).
- 프론트: `inspectImageFile`(형식·용량·디코딩)을 통과한 뒤 `upload(file)`; 미리보기는 blob → remote로 교체. 업로드 실패는 사진 영역 `role="alert"`에 문구(재선택·교체 가능). 등록 실패 시 pending 자산은 서버 TTL(24시간) 정리로 회수된다.
- 삭제는 작성자만(서버 403, 검증). 부분 실패(업로드 성공·게시 실패) 재시도는 '추억 등록' 재시도로 같은 자산을 다시 붙일 수 있다(`submitToken` 새로 발급).

## 5. 집안일

- `GET/POST /api/v2/chores`, `PATCH/DELETE …/:id`, `PUT …/:id/status { status, expectedRevision }`(목표 상태, 토글 아님). 완료 시각·완료자는 서버가 기록. 담당자/작성자 외 완료 → 403, 완료된 항목 수정 → 403 `CHORE_COMPLETED`.
- 프론트 0.7초 잠금(`useBusyId`)은 편의 장치이고 중복·동시 수정은 `requestId`·`expectedRevision`으로 서버가 막는다.

## 6. 홈·캐릭터·테마

- 홈은 `useFamily()`(테마·구성원·캐릭터)·`useMind()`(새 마음 배지)·세 provider만 읽는다. 캐릭터 위치는 UI 상태(저장 안 함).
- 테마는 `family.theme` 한 값이며 관리자가 바꾸면 다른 구성원은 세션 재조회(탭 복귀·새로고침) 때 반영된다(검증: A 변경 → B 참여 시 '별빛 테라스'). 실시간 푸시는 없다.

## 7. 검증 결과 (2026-11-01, 로컬 SQLite, 합성 계정 2개, 헤드리스 Chrome 390px)

| 항목 | 결과 |
|---|---|
| typecheck · lint · production build(`npm run build`) | 통과 |
| 백엔드 테스트 `tests/v2-service.test.ts` 8/8, v3·v5 SQLite 테스트, 엔진 테스트 | 통과(exit 0). v4 Postgres·v5 AI 원장 Postgres 테스트는 DB가 없어 실행 안 함 |
| 프로덕션 서버 `/login` 200, `/design-system` 404, `/api/health` ok | 통과 |
| 계정 2개 가입 → A 가족 생성(관리자) → 초대코드 → B 참여 | 통과 |
| 관리자만 테마·초대·이름(UI 숨김 + API 403), 구성원은 본인 캐릭터만 | 통과 |
| A 일정·사진을 B가 조회, B는 A 사진 삭제 불가(UI + API 403) | 통과 |
| 새로고침·로그아웃·잘못된 비밀번호 오류·재로그인 후 데이터 유지 | 통과 |
| 다른 가족/비회원의 직접 URL(`/inbox/nope`) → 안내 | 통과 |
| 마음: AI 비활성 503 안내 → 직접 작성 → 확인 → 전송(연타 1회) → 상대 새 마음 배지 → 상세 진입 읽음 → 답장 → 보낸 쪽 '답장 받음' | 통과 |
| 실제 AI 제안 → 수정 → 전송 | **미검증**(키·승인·비용 필요) |
| 집안일: A 추가 → B '가족 전체'에서 조회, B는 A 담당 항목 완료 체크 불가(UI) | 통과 |
| 데모 모드(`NEXT_PUBLIC_APP_MODE=demo`, 3200): 데모 가족 4인 홈, 프로토타입 제어, seed 집안일·데모 안내, `/login`은 데모 안내만 | 통과 |
| 응답 유실·장시간 지연·동시 수정 409 | 단위 테스트로만(브라우저 미검증) |
| 백엔드 Playwright E2E(`tests/*.spec.ts`), PostgreSQL/Supabase 프로필 | **미실행**(브라우저 설치·DB 없음) |
| 360/430/데스크톱 회귀, 드래그·키보드·포커스 | Figma 단계 결과 유지(통합 후 재캡처는 390만) |
| 실기기 | 미검증 |

## 8. 미연결·남은 위험

- AI 제안은 설정·승인 전까지 항상 "직접 작성". 이메일 인증·재설정 화면 없음. 푸시 알림 없음.
- 세션 재조회는 탭 복귀·명시적 동작에만 일어나 다른 구성원의 변경이 즉시 보이지는 않는다.
- 예전 가족(설정 레코드 없음)은 `user_id` 정렬상 첫 구성원을 관리자로 본다(결정적이지만 임의). 운영 DB에 적용할 때는 관리자 지정 절차를 정해야 한다.
- 로컬 `.env.local`은 git 제외이며 운영 값이 아니다. 운영 저장소·AI 활성화·공개 배포는 별도 승인.

## 9. 백엔드 확인 질문

1. 초대코드 **미리 조회**(가족 이름·인원 확인) API를 추가할지, 지금처럼 참여 요청으로만 검증할지.
2. 관리자 이전·복수 관리자, 가족 탈퇴, 한 사용자 여러 가족 허용 여부와 그에 따른 `family-settings` 정책.
3. 다른 구성원 변경(테마·메시지·일정)을 폴링/푸시로 알릴지, 현재처럼 탭 복귀 재조회로 둘지.
4. AI 활성화 절차(키 파일·예산 원장·합성 계정 allowlist)와 실제 사용자 원문 전송 승인 범위.
5. 이메일 인증·비밀번호 재설정 발송 도메인과 화면 연결 시점.
