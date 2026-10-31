# 최신 프론트 백엔드 연동 계획

작성: 2026-11-01 (Asia/Seoul). 상태: 계획 초안, 구현 미착수.

## 1. 작업 의뢰와 기준

- 목적/독자: 프론트·백엔드 개발자가 최신 우리집 화면을 실제 인증·영속 저장·AI에 연결할 수 있도록 계약 차이, 구현 순서, 검증 기준을 정한다.
- 원문: `민경민` 브랜치 `a5e474a2cbe5812105acceba90a1ecc60600e8ab`, `docs/frontend-integration.md` 0~9장. 원문 코드 기준은 `d9143e6`이다.
- 원격 증거: 2026-11-01 `git fetch origin 민경민` 성공, 원격 추적 ref가 `ef47b6a`에서 `a5e474a`로 갱신됨. GitHub connector는 404였으므로 Git fetch 및 git show로 확인했다.
- 비교 대상: 로컬 `codex/relationship-integration` HEAD `b5dc733c2014254ba43a1f70dbecb6f6cf6345b4`와 현재 읽은 작업 트리. 기존 원문·provider 등 미커밋 수정은 보존한다. 재사용 후보가 현재 테스트를 통과했다는 뜻은 아니다.
- 변경 범위: 이번에는 계획 문서만 추가. 앱 코드, 브랜치 merge, DB migration, 배포, 모델 호출은 하지 않는다. 픽셀 시안 적용은 별도 디자인 작업이다.
- 완료 증거: 원격 SHA, 원문과 실제 타입/권한 함수 대조, 기존 서버 계약과 차이 표, API 초안, 단계별 수용 기준.
- 루트 ACTIVE.json은 아직 제품 미선정으로 남아 있어 현재 저장소 상황과 불일치한다. 현재 요청이 명시한 저장소/브랜치를 우선하며 전역 상태는 이번에 자동 변경하지 않는다.

## 2. 확정 결정과 미정 사항

### 사용자가 확정한 정책

- **개인 원문·AI 초안은 서버에 보관하지 않고 제안 생성 때만 처리한다.** 이번 대화에서 명시적으로 선택했다.
- 원문/생성 초안은 요청 처리 중 메모리에만 두고 DB, 캐시, 작업 큐, 요청 영수증, 로그, 오류 수집, 분석 이벤트에 저장하지 않는다. 전달 직전 사용자가 확정한 최종 문장은 공유 메시지로 저장한다.
- 브라우저 초안은 메모리만 사용한다. 새로고침·로그아웃·세션 사용자 변경 시 폐기하며 복구 가능하다고 안내하지 않는다. 원문/수신자 변경 시 기존 AI 제안을 무효화한다.
- 외부 모델 제공자의 데이터 보존 정책은 앱 서버 비보관과 별개다. 제공자 요청 저장 옵션 및 운영 정책을 구현 시 확인하고, 앱 비보관을 제공자 무보관 보장으로 표현하지 않는다.

### 제안이며 아직 확정되지 않은 사항

- 기존 Better Auth 이메일/비밀번호 + 서버 세션 쿠키 재사용. 브라우저 토큰 localStorage 저장 없음.
- 초기에는 1사용자 1가족, 부모/자녀 역할은 표시용. 이것은 현재 membership PK와 일치하지만 제품 정책 확정이 필요하다.
- 우선 목표(로컬 전체 연동 / 배포용 DB·저장소 전환)는 사용자 답변 대기. 아래 단계는 로컬 검증과 배포 준비를 분리해 어느 쪽에도 사용할 수 있게 한다.
- 기본 시간대 Asia/Seoul, 반복·여러 날 일정 제외, 외부 푸시·메일 알림 제외. 기존 프론트의 범위를 유지하는 제안이다.
- 서버 원문 비보관이 확정되어 기존 private.create/개인 이력 복구 경로는 새 /mind에 재사용하지 않는다. 기존 저장 원문은 자동 삭제하거나 이관하지 않는다. 실제 저장 자료 유무를 내용 출력 없이 점검하고 보존/삭제 범위를 별도로 정한다.

## 3. 확인된 계약 차이

| 영역 | 최신 민경민 프론트 | 기존 통합 코드 | 계획 |
|---|---|---|---|
| 현재 사용자 | DemoViewerProvider, 임의 인물 전환 | Better Auth, households/memberships | 세션 DTO로 provider 교체, 데모 전환 제거 |
| 구성원 | id/name/role/tone/avatar | id/name | 공개 Member DTO 및 저장 필드 보강; 다른 구성원의 email은 노출하지 않음 |
| 일정 | date/allDay/startTime/endTime/category/location/memo/createdBy | start/end ISO instant, revision, 제목 최대200 | 프론트 계약(제목40/장소40/메모200)을 기준으로 신규 저장·DTO; 기존 AI 일정 변환 경계 명시 |
| 마음 전하기 | 최종 문장, 1:1 발신/수신, 읽음·응답 | privateEntries, sharedCards, coordination, plan | 간단한 메시지 서비스를 새로 연결; 조율/전원 수락과 동일시하지 않음 |
| 개인 원문 | 브라우저 메모리 | private 문서 payload에 저장 | 새 API는 비영속 처리, 기존 개인 문서 서비스 호출 금지 |
| 집안일 | 명시적 todo/done, 작성자/담당자 권한 | 해당 API 없음 | CRUD·목표 상태 API·revision 추가 |
| 사진 | 탭 object URL, MemoryPost/Asset | 해당 API/저장소 없음 | 비공개 자산 업로드·확정·삭제 및 remote 자산 타입 추가 |
| 홈 | 세 provider에서 요약 | 오래된 홈 + /home/heart 연결 | 최신 HomeSummary를 유지하고 동일 데이터 캐시에서 읽음 |

근거 파일: 원문 1~7장, 원격 `lib/calendar/types.ts`, `lib/mind/types.ts`, `lib/mind/relationship-demo-adapter.ts`, `lib/chores/permissions.ts`, `lib/memories/types.ts`; 로컬 `src/contracts/family.ts`, `src/lib/server/{auth,database,http,family-service}.ts`, `migrations/001-host.sql`.

문서 교정 메모: 원문 2장의 “DemoViewerSwitch 렌더 위치 5곳”은 뒤에 11개 화면을 열거한다. 제거 범위는 숫자 5가 아니라 실제 참조 검색 결과로 확정한다.

## 4. 서버 구조와 데이터 설계 초안

- 현재 Next.js Route Handlers와 TypeScript를 유지한다. HTTP → 인증/가족 범위 → 입력 검증 → 도메인 서비스 → 저장소 순서로 분리한다. 새로운 독립 서버 프레임워크는 지금 필요하지 않다.
- 브라우저가 보낸 fromId/authorId/createdBy/familyId는 권한 근거로 사용하지 않는다. 로그인 세션과 membership에서 결정한다. 다른 가족의 객체와 존재하지 않는 객체는 동일한 404로 처리하는 것을 기본으로 한다.
- DTO는 프론트 필드와 맞추고 서버 필드 `revision`, `createdAt`, `updatedAt` 등을 필요한 곳에 추가한다. 공개 DTO에 seed, 개인 원문, 내부 저장 경로, 비밀키를 포함하지 않는다.
- 데이터 후보: families, memberships(표시 이름/캐릭터), invites(해시·만료·폐기), calendar_events, event_participants, mind_messages, mind_responses, chores, memory_assets, memory_posts, mutation_receipts. Auth 테이블은 인증 라이브러리 경계에 둔다.
- 모든 업무 레코드에 family_id; 작성/완료/응답 주체는 서버 기록. 개인 초안 테이블은 새 마음 전하기에 만들지 않는다.
- 초대 코드는 해시 보관·만료·사용 정책을 계약에 넣고 모든 일반 가족 조회에 초대 코드를 반환하는 기존 FamilyView 형태를 답습하지 않는다.
- 날짜 전용 값은 DATE 의미의 YYYY-MM-DD, 시간은 HH:mm, 종일은 시간 null. 감사 시각은 UTC ISO로 저장한다. 일정 날짜를 암묵적으로 UTC로 바꾸지 않는다.
- 기존 AI schedule start/end 경로와 새 CalendarEvent를 별도 원본으로 복제하지 않는다. 단일 일정 저장소의 명시적 timezone 변환 adapter로 연결하고, 종일/참여자/작성 권한을 표현하지 못하면 조율 대상에서 제외한다. 일정 수정/삭제는 연결된 plan의 과거 버전 수락을 무효화해야 한다.
- SQLite 파일은 로컬 검증용. 현재 database.ts는 VERCEL에서 시작을 거부한다. 배포 대상이 정해지면 외부 영속 DB와 비공개 파일 저장소 adapter를 선정한다. 지금 계정/서비스 생성은 하지 않는다.

## 5. API 초안 — 구현 전 계약으로 고정할 제안

기존 /api/family 명령 endpoint는 기존 조율용으로 격리한다. 새 프론트의 provider에는 기능별 endpoint를 연결하되 인증·권한·저장소 로직은 공유한다. 아래 경로는 원문의 확정 사양이 아니라 이 계획의 제안이다.

| 경로 | 메서드 | 입출력/핵심 규칙 |
|---|---|---|
| /api/session | GET | viewerMemberId, family|null, members; 필요한 공개 필드만 |
| /api/auth/* | 라이브러리 규약 | 가입·로그인·로그아웃·세션 |
| /api/families | POST | 가족 생성 + 본인 membership 원자적 생성 |
| /api/family/invites, /api/family/join | POST | 초대 발급/코드 검증 후 가입; 제한·만료·중복가입 검사 |
| /api/calendar/events | GET, POST | 날짜 범위 조회, CalendarEvent 생성; 가족 참여자 검증 |
| /api/calendar/events/:id | GET, PATCH, DELETE | 작성자만 수정/삭제; revision 비교 |
| /api/chores | GET, POST | status/mine 필터; 서버 담당자 검증 |
| /api/chores/:id | GET, PATCH, DELETE | 미완료 작성자만 수정, 작성자 삭제 |
| /api/chores/:id/status | PUT | 목표 todo/done + expectedRevision; 작성자/담당자만; 완료 감사 필드 서버 기록 |
| /api/mind/suggestions | POST | rawText≤500, recipientMemberId, clientDraftVersion → suggested text/label; 비영속, 명시적 클릭에서만 호출 |
| /api/mind/messages | GET, POST | 발신/수신 목록; text≤500 + recipientMemberId + requestId; 최종 확인 후 전송 |
| /api/mind/messages/:id | GET | 발신자/수신자만 상세 조회; GET 자체는 상태를 변경하지 않음 |
| /api/mind/messages/:id/read | PUT | 수신자 상세 진입 시 호출; 클릭/직접 URL 동일 경로; read 재호출은 무해하며 responded 상태를 되돌리지 않음 |
| /api/mind/messages/:id/response | PUT | reply(text≤300)/later/declined; 수신자만; 허용 상태 전이와 revision 검증 |
| /api/memories/assets | POST | 인증된 업로드; private pending asset id 반환 |
| /api/memories | GET, POST | 게시물 조회/생성; 본인 소유·같은 가족·검사완료 pending 자산만 연결 |
| /api/memories/:id | GET, DELETE | 같은 가족 조회; 작성자 삭제 |
| /api/memories/assets/:id/content | GET | 가족 권한 검증 후 이미지 또는 짧은 유효기간 URL; 공개 버킷 URL 금지 |

응답 제안: 성공 `{data: ...}`, 오류 `{error:{code,message,fieldErrors?,requestId?}}`; 클라이언트가 입력한 원문은 오류 응답/로그에 되비추지 않는다. 상태 코드 401 로그인/만료, 403 동일가족 권한부족, 404 객체 비노출, 409 버전/멱등 충돌, 413 크기초과, 415 이미지형식, 422 필드오류, 429 한도, 503 일시장애.

세션 쿠키 쓰기 요청에 same-origin/CSRF 방어를 일관 적용하고 private 응답은 no-store. 목록은 기간/페이지 크기 상한을 두며 다른 계정에 개인 원문을 포함한 전체 FamilyView를 반환하는 패턴을 새 기능에 확장하지 않는다.

## 6. 중복·동시성·실패 복구

- 생성/전송에는 requestId를 유지한다. 네트워크 타임아웃 재시도는 같은 키, 수정된 payload는 새 키. 동일 actor+operation+키의 다른 payload는 409.
- 업무 변경과 성공 영수증은 같은 트랜잭션으로 커밋한다. 기존 service.command는 execute 후 영수증을 별도로 갱신하므로 “변경 성공 후 프로세스 종료”와 영구 pending의 복구를 보강해야 한다. 기존 구현을 그대로 복제하지 않는다.
- 수정/삭제에는 expectedRevision과 원자적 비교·변경을 쓴다. 동일 목표 상태의 중복 완료는 completedAt을 새로 만들지 않는다. 다른 버전 변경은 충돌로 알려 재조회한다.
- 프론트는 성공 응답을 받은 뒤 서버 데이터를 반영하는 것을 기본으로 한다. 낙관 갱신을 쓰는 곳은 실패 rollback과 재시도 문구를 구현한다. 목록·상세·홈 캐시는 같은 키/무효화 규칙을 사용한다.
- 세션 만료 시 다른 사용자 데이터 캐시를 비우고 로그인으로 보낸다. 개인정보 draft를 URL/로컬 저장소로 옮겨 보존하지 않는다.
- AI는 자동 재시도하지 않는다. 원문 변경 후 늦게 도착한 응답은 clientDraftVersion으로 버린다. 생성 완료와 메시지 전송은 별개다. 모델 장애 시 사용자가 직접 문장을 다듬어 전송할 수 있게 한다.
- AI 중복 요청 처리는 입력/출력 원문을 영수증에 저장하지 않는 별도 경로를 쓴다. 처리 상태/비용 예약만 기록하고, 연결 종료 후 결과를 재조회로 복구할 수 있다고 약속하지 않는다. 재생성은 새로운 명시적 요청이다.
- 사진: 10MiB JPEG/PNG/WebP를 서버에서 크기·실제 내용·디코딩·픽셀 수로 검사, 메타데이터 제거/재인코딩. 이미지 처리 구현 시 라이브러리와 실제 출력 MIME을 검증한다.
- asset 상태 pending→ready→attached 및 삭제/정리 상태를 둔다. 게시물 생성 실패는 즉시 정리 시도 + 미연결 자산 TTL 정리로 회수한다. 게시물 삭제 시 조회 권한을 먼저 차단하고 실제 파일 삭제 실패를 재처리한다. 서명 URL을 쓴다면 만료 전 잔여 접근 가능 시간을 정책에 명시한다.

## 7. 실행 순서와 완료 기준

| 단계 | 작업 | 완료 증거 |
|---|---|---|
| 0 계약/통합 준비 | 최신 민경민 SHA를 기준으로 별도 codex 브랜치 구성 계획, 기존 변경 보호, DTO·오류·권한·migration 합의 | 변경 파일 소유권, 계약 샘플, 원문 정책 기록 |
| 1 인증·가족 | 기존 인증 재사용, 가입/로그인/가족 생성·참가 화면 연결, SessionProvider, 데모 전환 차단 | 독립 브라우저 2계정 가입, 새로고침/재로그인, 다른 가족 접근거부 |
| 2 일정 | 최신 달력 CRUD, 날짜/종일/제목 제한, 홈 반영, 기존 조율 일정 adapter | A가 등록→B 조회, 작성자만 변경, 충돌409, 날짜 경계/윤일/종일 검사 |
| 3 집안일 | CRUD·담당자·목표 상태·감사 필드, 서버 권한 | 작성자/담당자/제3자 역할별 검사, 동시 완료/수정, 실패 복구, 홈 재조회 |
| 4 마음 | 비영속 AI 제안, 최종문장 전송, 수신/읽음/응답, 원문 변경 무효화 | DB·로그에 원문/초안 없음, 직접 URL 읽음, 타인/타가족 거부, 중복전송1회, 지연 응답 폐기 |
| 5 사진 | 비공개 업로드·remote DTO·게시물·삭제·고아 정리 | 두 계정 동일 사진, 새로고침 유지, 위조 MIME/손상/초과 차단, 미연결 자산 회수 |
| 6 통합/운영 준비 | 홈 가상 알림 제거/명확히 분리, 데모 seed 차단, 전체 실패 복구; 필요 시 배포용 저장소 전환 | typecheck/build/host/E2E, 모바일 실제 조작, 저장→서버 재시작→재조회, 배포 전 별도 승인 |

첫 수직 흐름은 “두 계정 같은 가족 → 일정 생성 → 다른 계정 조회 → 새로고침 유지”다. AI/업로드 의존 없이 인증과 가족 데이터 경계를 먼저 검증한다. 단계4의 AI는 승인된 합성 호출 범위 및 남은 예산을 먼저 확인하며 일반 사용자 실데이터 호출 권한으로 확대하지 않는다.

## 8. 병렬 구현 패킷 준비

계획 단계에서는 subagent를 실행하지 않았다. 구현 시 공통 계약과 base SHA를 메인이 확정·커밋한 후 프로젝트 worktrees.mjs로 UI/API/QA를 분리한다.

- 메인: 계약, migrations, auth 공통 설정, dependencies/lockfile, route 조립, 배포/환경 설정. 최신 root components/lib 구조가 기본 소유권 패턴과 다르므로 도구 설정을 먼저 확인한다.
- UI: 최신 provider의 비동기화·조회/저장/복구·실제 인증 화면 연결. 픽셀 디자인 변경은 제외.
- API: 합의된 서비스/저장소 adapter와 서버 검증. 공통 계약 변경은 메인 요청.
- QA: 최초 계약 기반 권한·동시성·직접 진입·이미지 실패 테스트. 통합 후 메인의 후보 SHA에서 소스 수정 없이 실행.
- 각 패킷: 절대 worktree 경로, base SHA, 정확한 소유 파일, 계약 버전, 검사 명령, 반환 commit/변경 파일/실행 결과/미검증 항목. 다른 작업자의 변경을 되돌리지 않도록 명시한다.
- 현재 미커밋 engine/prompts/provider/private/joint 변경은 별도 진행 중인 작업이다. 자동 stash/commit/reset/merge하지 않으며 포함할 버전을 확정한 후 다음 통합 후보를 만든다.

## 9. 검증 상태와 다음 행동

실행 완료: 원격 fetch, 최신 문서 전체 판독, 실제 프론트 타입/집안일 권한/AI adapter 대조, 기존 인증·DB·HTTP·영수증 코드 확인, 계획서 작성.

미실행: 코드 변경, migration, typecheck/build/테스트, 브라우저 연동 검증, 실제 AI 호출, 업로드, 배포. 기존 테스트 파일 존재는 이번 변경의 합격 증거가 아니다.

다음 행동: 우선 목표 답변 반영 → 공개 DTO/오류/권한 표를 실행 가능한 계약으로 고정 → 원격 최신 프론트와 기존 backend의 겹치는 app/calendar·app/more·home 조립부 통합 계획 확정 → 인증·가족+일정 수직 흐름부터 구현.
