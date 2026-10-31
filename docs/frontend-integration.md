# 프론트엔드 연동 준비 문서

- **코드 기준:** 브랜치 `feat/figma-frontend`, 이 문서를 포함한 모듈 F 커밋(직전 커밋 `5fa8fcc`). 이 문서는 실제 파일·타입·함수 이름을 그대로 적는다.
- **현재 상태:** 모든 기능이 **프론트 메모리 데모**다. 인증·API·DB·실제 AI·업로드·알림은 없다. 온보딩(환영·가족 만들기·초대코드 참여·내 캐릭터)은 **데모 흐름**으로 있고 로그인은 없다. 새로고침하면 모든 상태가 초기화된다.
- 표기: "UI가 지금 필요로 하는 값"과 "백엔드 협의 항목"을 구분한다. API 경로·HTTP 메서드는 정해진 것이 없으므로 명세처럼 쓰지 않는다.

## 변경 요약 (이전 문서 `d9143e6` 기준 대비)

| 구분 | 바뀐 것 |
|---|---|
| 상태 구조 | `DemoViewerProvider` → **`FamilyProvider`**(가족 목록·세션·권한·캐릭터·테마·위치) + **`FamilyScope`**(가족 id로 마음·일정·사진·집안일 provider 재마운트). `useDemoViewer`는 `useFamily`의 별칭으로 남아 있다 |
| 타입 | `Family`에 `adminMemberId`·`theme`·`inviteCode`·`seed?` 추가, `houseStage` 제거. `FamilyMember.avatar`가 `CharacterConfig{skin, hair, outfit, accessory}`로 바뀜. `role`은 호칭 문구일 뿐 권한이 아니다 |
| 권한 | `lib/family/permissions.ts`(`canChangeTheme`·`canInvite`·`canRenameFamily`·`canEditMember`) 추가. 집안일 권한은 그대로 |
| 라우트 추가 | `/welcome`, `/family/new`, `/join?code=`, `/me/character?from=`, `/family/theme`, `/calendar/new?date=`, `/calendar/[id]/edit`. `/`는 `/home`으로 이동 |
| 라우트 제거·변경 | 홈 알림 시트(가상 알림) 제거 → 종 아이콘은 `/inbox`로 이동. 캘린더 폼 시트 → 전체 화면 라우트 |
| 새 기능 | 가족 만들기·초대코드 참여(조회 어댑터)·내 캐릭터 편집·관리자 테마/초대/가족 이름·데모 가족 전환 |
| 마음 | 읽음 처리를 상세 진입 한 곳으로 통합(`MindDetailScreen`의 effect). AI 제안 미리 채움 없음 |
| 자산 | `public/assets/pixel/*`(Figma Make 생성 픽셀 SVG, 출처 `SOURCE.md`) |

## 0. 공통 구조

| 항목 | 위치 |
|---|---|
| 루트 provider | `app/layout.tsx`: `FamilyProvider` → `FamilyScope`(`MindProvider` → `CalendarProvider` → `MemoriesProvider` → `ChoresProvider`, 모두 `key={family.id}`·`seeded`) |
| 가족·세션·현재 사용자 | `components/family/family-provider.tsx` — `useFamily(): { family, viewer, viewerId, isAdmin, families, setViewerId, switchFamily, updateMyProfile, setTheme, renameFamily, createFamily, joinFamily, inviteAdapter, spotOf, moveMember }` |
| 가족 타입 | `lib/family/types.ts` — `Family { id, name, members, adminMemberId, theme, inviteCode, seed? }`, `FamilyMember { id, name, role?, tone, avatar }`, `memberRoleLabel` |
| 캐릭터 카탈로그 | `lib/character/catalog.ts` — `CharacterConfig`, 옵션 목록, `characterLayers`, `isValidCharacter` |
| 테마 카탈로그 | `lib/scene/themes.ts` — `SceneTheme`(5종), `isSceneTheme` |
| 데모 고정 데이터 | `lib/home.fixture.ts` — `DEMO_FAMILY_FOUR`(seed 가족, 관리자 `dad`), `DEMO_HOME`(기본 인물 `dad`) |
| 인물·가족 전환 UI(데모) | `components/demo/demo-viewer-switch.tsx`, `/more` 프로토타입 제어 |
| 날짜 유틸 | 시각(ISO/`Date`) → `lib/format.ts`(Asia/Seoul). 날짜 전용 `YYYY-MM-DD`·`HH:mm` → `lib/calendar/date.ts` |
| 공통 상태 UI | `components/woorijip/state-views.tsx`, `components/ui/skeleton.tsx`, `components/woorijip/leave-dialog.tsx`, `components/mind/use-return-focus.ts` |

**데모 모드 분리 지점**
- seed는 `FamilyScope`가 `family.seed === true`일 때만 각 provider에 `seeded`로 넘긴다. 서버 연결 시 `seeded={false}`로 두고 조회 결과로 채운다.
- `seed: true` 플래그는 "데모 예시" 표시 전용이다. 서버 데이터에는 없어야 한다.
- 개발 전용 오늘 고정 `?today=`는 `CalendarProvider.readToday`에서 `NODE_ENV !== "production"`일 때만 읽는다.

## 1. 가족·구성원·현재 사용자·권한

| 구분 | 현재 코드 |
|---|---|
| 화면 | 홈 상단 가족 이름, 구성원 시트(`HomeDetailSheet` `family`), `/more` 프로필 블록·가족 메뉴, `/family/theme`, 초대 시트, 가족 이름 대화상자 |
| 세션 | `FamilyProvider` 내부 `session { familyId, memberId }`. 모든 권한 판단과 작성자 기록(`fromId`·`createdByMemberId`·`authorId`)에 `viewerId`를 쓴다. 이름 문자열로 판정하지 않는다 |
| 권한 | `lib/family/permissions.ts`. UI 숨김과 provider 변경 함수(`setTheme`·`renameFamily`·`updateMyProfile`)가 같은 함수를 쓴다. **서버 검증이 아니다** |
| 검증 | `lib/family/validate.ts` — 가족 이름 18자, 구성원 이름 10자, 초대코드 정규화 |

**UI가 지금 필요로 하는 값:** 가족 id·이름·테마·관리자 구성원 id·초대코드(관리자에게만), 구성원 배열(id·이름·호칭·tone·캐릭터 설정), 현재 사용자의 구성원 id, 이 사용자가 속한 가족 목록(여러 가족 허용 시).
**교체 위치:** `FamilyProvider`의 `initialState()`를 세션·가족 조회 결과로 바꾸고, `createFamily`·`joinFamily`·`setTheme`·`renameFamily`·`updateMyProfile`·`switchFamily`가 API를 호출하도록 한다. 실패 시 각 화면의 `notice`(`role="alert"`) 영역을 이미 쓰고 있다.
**백엔드 협의 항목:** 로그인 방식, 세션에서 사용자 id·가족 id를 받는 방법, 캐릭터 설정 저장 형식(`CharacterConfig` 그대로 저장 가능), 관리자 이전·복수 관리자 여부, 한 사용자의 복수 가족 허용 여부.

## 2. 인증·온보딩·초대 경계

- **존재하는 화면(데모):** `/welcome`, `/family/new`(가족 이름 → 내 캐릭터 → 만든 사람이 관리자), `/join`(코드 조회 → 가족 확인 → 내 캐릭터 → 참여). "로그인 완료"로 표시하는 문구는 없고, 초대코드가 로그인을 대신하지 않음을 화면에 쓴다.
- **미구현:** 로그인, 로그아웃, 세션 만료, 가족 탈퇴, 관리자 이전, 초대 만료·사용 횟수 관리.
- **초대 조회 교체 지점:** `lib/family/invite-adapter.ts` `InviteAdapter.lookup(code, signal) → InviteLookup`(`ok | not-found | expired | already-member | error`). 데모 어댑터는 메모리 가족 목록에서 찾고 500ms 지연한다(`DEMO_EXPIRED_CODE = "OLD000"`). `JoinFamilyScreen`은 로딩(`aria-busy`)·오류(`role="alert"`)·취소(AbortController)를 이미 처리한다.
- **초대 링크:** `lib/family/invite.ts` `inviteLink(code, origin)` → `/join?code=`. 링크에 개인 정보를 넣지 않는다.
- **가족 분리:** 가족을 만들거나 참여하면 세션이 바뀌고 `FamilyScope`가 다시 마운트되어 이전 가족의 마음·일정·사진·집안일이 화면에 남지 않는다(사진 provider는 사라질 때 blob URL 해제).
- **데모 전용 제거 지점(실제 인증 연결 시):** `DemoViewerSwitch` 렌더 위치(모든 기능 화면 상단), `/more` 프로토타입 제어(인물·가족 전환, 온보딩 다시 보기), `useFamily().setViewerId/switchFamily`, `/join`의 체험 코드 칩, `/welcome`의 "지금 가족으로 돌아가기".
- **하지 않는 것:** 인증 방식이 확인되기 전에는 토큰 저장(localStorage 등)이나 가짜 로그인 페이지를 만들지 않는다.

## 3. 마음 전하기·수신함

| 구분 | 현재 코드 |
|---|---|
| 화면 | `/mind`(`mind-screen.tsx`, 3단계 + 완료), `/inbox`(`inbox-screen.tsx`, 행 목록 `mind-card.tsx`), `/inbox/[id]`(`mind-detail-screen.tsx`) |
| 타입 | `lib/mind/types.ts` `MindMessage`·`MindDraft`·`MindResponse` (변경 없음) |
| provider | `components/mind/mind-provider.tsx` — `useMind()`, 액션 `draft/update`·`draft/step`·`draft/reset`·`message/send`(confirmToken)·`message/read`·`message/respond`. `seeded` prop 추가 |
| AI adapter | `lib/mind/relationship-demo-adapter.ts` `relationshipAdapter`(교체 지점). 현재 `mode: "manual"`만 사용 |

**분리 원칙(구현됨):** `MindDraft.rawText`는 `MindMessage`로 복사되지 않는다. 다듬기 단계는 원문을 읽기 전용으로 보여 주고 전달 문장은 비어 있는 채 시작한다(고정 예시로 미리 채우지 않음). '예시 흐름 보기'는 합성 예시이며 확인 후에만 초안에 넣는다.
**읽음 처리(해결):** `MindDetailScreen`의 effect가 `message.toId === viewerId && status === "sent"`일 때만 `message/read`를 보낸다. 목록 클릭·URL 직접 진입이 같은 경로이고, 보낸 사람이 열어도 읽음으로 바뀌지 않는다. 서버 연동 시 이 자리가 "상세 조회 = 읽음 처리" 호출이 된다.
**UI가 지금 필요로 하는 값:** `MindMessage` 전 필드, 전송 응답의 메시지 id(현재 클라이언트 생성), AI 제안 응답 `DraftResult{ mode: "suggested", text, label }`.
**요구사항:** AI 요청은 사용자가 요청할 때만(`RefineStep.copyRaw`가 유일한 호출 지점). 전송은 확인 단계의 버튼으로만(`confirmToken` 1회). 원문·초안을 응답·알림·URL·로그·분석에 넣지 않는다. 지연·실패 UI(`AdapterStatus` loading/error)는 준비돼 있고 재시도 버튼은 미구현.
**백엔드 협의 항목:** AI 제안 요청·응답 형식과 원문 보관 정책, 메시지 생성·응답·읽음 API, 알림 발송 주체.

## 4. 캘린더

| 구분 | 현재 코드 |
|---|---|
| 화면 | `/calendar`(`calendar-screen.tsx`, `?saved=&date=` 복귀), `/calendar/new?date=`(`event-new-screen.tsx`), `/calendar/[id]/edit`(`event-edit-screen.tsx`), 홈 '오늘 일정'·일정 시트 |
| 타입·검증 | `lib/calendar/types.ts`·`validate.ts`(변경 없음). `EventForm`은 본문 전용(`formId`) |
| provider | `components/calendar/calendar-provider.tsx` — `useCalendar()`(변경 없음) + `seeded` |

**날짜·시간:** 문자열 그대로 저장·비교(`Date` 변환 없음). 서버도 date·time 문자열을 그대로 저장해야 홈·달력의 "오늘"과 맞는다. 여러 날·반복 일정은 미구현.
**UI가 지금 필요로 하는 값:** `CalendarEvent` 전 필드, 생성 응답의 id. 수정·삭제 권한은 `createdByMemberId === viewerId`(데모 규칙, 서버 재검증 필요).

## 5. 추억 사진

| 구분 | 현재 코드 |
|---|---|
| 화면 | `/memories`(와이드 첫 타일 격자), `/memories/new`(`FlowPage`, 기기 파일 선택), `/memories/[id]`, 홈 '최근 추억' |
| 타입·검사·provider | `lib/memories/*`, `memories-provider.tsx`(변경 없음) + `seeded`, 가족 전환 시 blob URL 전체 해제 |

**전환 위치:** `MemoryNewScreen.handleFiles` 성공 직후에 업로드 호출, `addPost`가 생성 API 호출(실패 시 업로드 자산 정리 미구현), 삭제·조회 권한 서버 검증. Unsplash 같은 외부 사진은 쓰지 않는다.
**백엔드 협의 항목:** 업로드 방식(직접 vs 서명 URL), 허용 형식·용량, 썸네일, 삭제 시 자산 처리.

## 6. 집안일

| 구분 | 현재 코드 |
|---|---|
| 화면 | `/chores`(행 목록, 내 할 일/가족 전체 × 할 일/완료 필터가 목록에 적용), `/chores/new`·`/chores/[id]/edit`(`FlowPage`), `/chores/[id]`, 홈 '내 할 일' |
| 타입·검증·권한·provider | `lib/chores/*`, `chores-provider.tsx`(변경 없음) + `seeded` |

**연동 시 주의:** 완료는 목표 상태를 명시하는 `setStatus(id, status)`(토글 아님). `completedAt`·`completedByMemberId`는 서버가 기록해야 한다. 0.7초 잠금(`useBusyId`)은 프론트 편의 장치이며 멱등 키·동시 수정 제어를 대신하지 않는다. 변경 함수는 동기 boolean을 돌려주므로 연동 시 Promise + 실패 알림으로 바꾼다.

## 7. 홈·장면·캐릭터

- `components/home/home-screen.tsx`는 `useFamily()`·`useMind()`(새 마음 수 배지)·`HomeSummary`(`useCalendar`·`useChores`·`useMemories`)만 읽는다. 별도 데이터 원본이 없다.
- 캐릭터 위치(`spotOf`·`moveMember`)는 **화면 연출용 UI 상태**이며 서버에 저장할 필요가 없다(저장하려면 가족별·구성원별 `SceneSpot{x,y}` 한 쌍).
- 테마 변경은 `family.theme` 한 값만 바꾼다. 다른 데이터에 영향이 없음을 provider 구조로 보장한다.
- 캐릭터 설정은 `FamilyMember.avatar: CharacterConfig`. 서버는 이 네 키를 그대로 저장하고, 카탈로그에 없는 값은 `isValidCharacter`로 거른다.

## 8. 연동 완료 기준 체크리스트 (현재 충족 여부)

| 기준 | 현재 |
|---|---|
| 실제 계정 2개로 같은 가족에 참여 | ❌ 미구현(인증 없음). 데모 온보딩·초대 조회 어댑터·가족 분리 구조는 준비됨 |
| 한 계정이 등록한 일정·사진·집안일을 다른 계정에서 조회 | ❌ 미구현(같은 탭 메모리 안에서 인물 전환으로만 시뮬레이션) |
| 새로고침·다시 로그인 후에도 서버 데이터 유지 | ❌ 미구현(새로고침 시 초기화) |
| 실제 자유 입력으로 AI 제안 생성, 작성자가 수정·확인 후 전달 | ❌ AI 미연결(직접 작성·확인·전달 흐름은 구현됨, 제안 미리 채움 없음) |
| 수신자는 최종 전달 문장만 확인, 원문·초안 조회 불가 | ◐ 프론트 데이터 분리는 구현됨, 서버 차단은 미구현 |
| 다른 가족 데이터·타인의 개인 초안 서버 차단 | ◐ 프론트에서는 가족 전환 시 분리됨, 서버 차단은 미구현 |
| 관리자만 테마·초대·가족 이름, 본인만 캐릭터 | ◐ 프론트 규칙·UI·provider 검사 구현, 서버 검증 미구현 |
| 직접 URL 진입·느린 응답·실패·재시도·중복 클릭 처리 | ◐ 직접 진입·없는 ID·중복 클릭·읽음 처리 구현, 초대 조회만 로딩·오류 UI 있음, 그 밖의 느린 응답·재시도 UI 미구현 |
| 휴대폰 브라우저에서 입력·사진 선택·키보드·하단 버튼·드래그 확인 | ❌ 미검증(헤드리스 브라우저 시뮬레이션만, 360/390/430·데스크톱 폭) |

## 9. 백엔드 팀 확인 질문 (최대 5개)

1. **인증·세션:** 로그인 방식(세션 쿠키 vs 토큰)과 프론트가 받는 사용자 id·가족 id·구성원 목록·관리자 id의 형태는? 한 사용자가 여러 가족에 속할 수 있나?
2. **초대:** 초대코드 발급·만료·사용 횟수·재발급을 서버가 관리하나? 조회 응답은 `InviteLookup`의 네 상태(ok/없음/만료/이미 참여)로 구분해 줄 수 있나? 참여 시 구성원 생성과 캐릭터 설정을 한 요청으로 받나?
3. **API·오류 형식:** 일정·사진·집안일·메시지·가족 설정(테마·이름·캐릭터)의 생성/수정/삭제 응답과 오류(권한·검증·충돌) 형식은? 멱등 키나 `updatedAt` 비교를 지원하나?
4. **AI·메시지 흐름:** AI 제안 요청에 원문을 서버로 보내야 하나? 보낸다면 보관·로그 정책은? 제안 응답 시간과 실패 시 재시도 규칙, 메시지 읽음 처리(상세 조회와 동일 경로) API는?
5. **사진 업로드:** 직접 업로드 vs 서명 URL, 허용 형식·용량, 썸네일·원본 URL 제공 방식, 게시물 생성 실패 시 업로드 자산 정리 책임은?
