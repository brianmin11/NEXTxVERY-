# 프론트엔드 연동 준비 문서

- **코드 기준 커밋:** `d9143e6` (브랜치 `민경민`, 6단계 집안일까지 포함). 이 문서는 실제 파일·타입·함수 이름을 그대로 적는다.
- **현재 상태:** 모든 기능이 **프론트 메모리 데모**다. 인증·API·DB·실제 AI·업로드·알림은 없다. 로그인·가족 생성·초대·가입·로그아웃 화면은 **미구현**이며, 이 프론트는 완성된 앱이 아니다.
- 표기: "UI가 지금 필요로 하는 값"과 "백엔드 협의 항목"을 구분한다. API 경로·HTTP 메서드는 아직 정해진 것이 없으므로 명세처럼 쓰지 않는다.

## 0. 공통 구조

| 항목 | 위치 |
|---|---|
| 루트 provider 중첩 | `app/layout.tsx`: `DemoViewerProvider` → `MindProvider` → `CalendarProvider` → `MemoriesProvider` → `ChoresProvider` |
| 현재 인물(데모) | `components/demo/demo-viewer-provider.tsx` — `useDemoViewer(): { family, viewer, viewerId, setViewerId }` |
| 가족·구성원 고정 데이터 | `lib/home.fixture.ts` — `DEMO_HOME.family`(`Family`: id·name·members[]·houseStage), `FamilyMember`(id·name·role?·tone·avatar{face, accessory}) |
| 인물 전환 UI | `components/mind/demo-viewer-switch.tsx` (`DemoViewerSwitch`) — 홈을 제외한 기능 화면 상단에 있음 |
| 날짜 유틸 | 시각(ISO/`Date`) → `lib/format.ts`(ko-KR, Asia/Seoul 고정). 날짜 전용 `YYYY-MM-DD`·시간 `HH:mm` → `lib/calendar/date.ts`(`todayKey`, `isValidDateKey`, `formatDateKey`…) |
| 시간대 | `lib/calendar/config.ts` `CALENDAR_DEFAULT_TIME_ZONE = "Asia/Seoul"`, `lib/format.ts` `TIME_ZONE`. 가족 설정 시간대는 **미구현** |
| 공통 상태 UI | `components/woorijip/state-views.tsx` `EmptyState`/`ErrorState`(재시도 버튼 slot), `components/ui/skeleton.tsx` |
| 유실 확인 | `components/woorijip/leave-dialog.tsx` |
| 트리거 없는 모달 포커스 복귀 | `components/mind/use-return-focus.ts` |

**데모 모드 분리 지점(seed가 실제 데이터와 섞이지 않게):**
- seed 생성은 각 provider의 `useReducer` 초기화 함수 한 곳에서만 일어난다: `lib/mind` seed는 `MindProvider`의 `SEED_MESSAGES`, `lib/calendar/fixture.ts seedEvents`, `lib/memories/fixture.ts seedMemories`, `lib/chores/fixture.ts seedChores`. 서버 연결 시 이 초기값을 빈 배열로 바꾸고 조회 결과로 채운다.
- `seed: true` 플래그는 화면에 "데모 예시" 배지를 그리는 용도뿐이다. 서버 데이터에는 이 필드가 없어야 한다.
- 개발 전용 오늘 고정 `?today=`는 `CalendarProvider.readToday`에서 `NODE_ENV !== "production"`일 때만 읽는다.

## 1. 가족·구성원·현재 사용자

| 구분 | 현재 코드 |
|---|---|
| 화면 | 전용 화면 없음. 홈 헤더 가족 이름(`HomeScreen`), 가족 목록 시트(`HomeDetailSheet` `family`), 프로필 시트(`member`) |
| 타입 | `Family`, `FamilyMember`(`lib/home.fixture.ts`), `MemberTone`(`components/woorijip/member.tsx`) |
| 현재 사용자 | `useDemoViewer().viewerId` — 모든 기능의 권한 판단과 작성자 기록(`fromId`, `createdByMemberId`, `authorId`)에 쓰인다 |
| 검증 | 없음 |
| 로딩·실패 | 없음(고정 데이터) |

**UI가 지금 필요로 하는 값:** 가족 id·이름, 구성원 배열(id·표시 이름·캐릭터 tone·avatar face/accessory), 현재 사용자의 구성원 id.
**교체 위치:** `DemoViewerProvider` 내부의 `DEMO_HOME.family`·`useState(DEMO_HOME.viewerId)`를 서버 세션·가족 조회 결과로 교체한다. `setViewerId`는 실제 모드에서 제거한다(아래 2장).
**백엔드 협의 항목:** 로그인 방식, 세션에서 사용자 id·가족 id를 받는 방법, 구성원 표시 이름·캐릭터 설정 저장 여부, 역할(`role`) 필드의 의미.

## 2. 인증과 가족 경계

- **존재하는 화면:** 없음. `grep`으로 확인한 "로그인" 문자열은 "데모 인물 전환 · 로그인이 아니에요" 안내뿐이다.
- **미구현:** 로그인, 로그아웃, 가족 생성, 초대 링크/코드, 가입 수락, 가족 탈퇴, 세션 만료 처리.
- **가족 id·사용자 id를 얻을 곳:** 현재는 `DEMO_HOME.family.id`("fam-four")와 `viewerId`. 실제 모드에서는 세션 응답에서 받아 `DemoViewerProvider`(이름 변경 권장: 예 `SessionProvider`) 한 곳에만 둔다.
- **서버 검증이 필요한 지점(프론트 규칙은 참고용):**
  - 마음: 메시지 조회(수신자·발신자만), 응답(`toId === 사용자`만), 원문 비공개.
  - 일정: 수정·삭제는 `createdByMemberId === 사용자`(`CalendarScreen`의 `canEdit`).
  - 사진: 삭제는 `authorId === 사용자`(`MemoryDetailScreen` `canDelete`).
  - 집안일: `lib/chores/permissions.ts`의 `canEditChore/canDeleteChore/canToggleChore`와 같은 규칙.
  - 모든 조회: 같은 가족(`familyId`) 범위.
- **데모 인물 전환과 실제 인증을 동시에 쓰지 않기 위해 제거·차단할 지점:**
  - `DemoViewerSwitch` 렌더 위치 5곳: `MindScreen`, `InboxScreen`, `MindDetailScreen`, `CalendarScreen`, `MemoriesScreen`, `MemoryDetailScreen`, `MemoryNewScreen`, `ChoresScreen`, `ChoreNewScreen`, `ChoreEditScreen`, `ChoreDetailScreen`.
  - `useDemoViewer().setViewerId` 자체를 제거하거나 no-op으로 만든다.
  - `DemoBadge`(`components/woorijip/app-shell.tsx`)와 각 화면의 "프론트 데모" 배지·안내 문구.
  - `/design-system`은 이미 프로덕션 404.
- **하지 않는 것:** 백엔드 인증 방식이 확인되기 전에는 토큰 저장(localStorage 등)이나 가짜 로그인 페이지를 만들지 않는다.

## 3. 마음 전하기·수신함

| 구분 | 현재 코드 |
|---|---|
| 화면 | `/mind`(`components/mind/mind-screen.tsx`), `/inbox`(`inbox-screen.tsx`), `/inbox/[id]`(`mind-detail-screen.tsx`) |
| 타입 | `lib/mind/types.ts`: `MindMessage { id, fromId, toId, text, createdAt, status: "sent"\|"read"\|"replied"\|"later"\|"declined", response: MindResponse\|null }`, `MindResponse`(reply{text, at} / later{at} / declined{at}), `MindDraft { recipientId, rawText, outgoingText, step, confirmToken, sentMessageId }` |
| 제한 | `lib/mind/config.ts` `MIND_MAX_LENGTH=500`, `MIND_REPLY_MAX_LENGTH=300` |
| provider | `components/mind/mind-provider.tsx` — `useMind(): { messages, draft, draftDirty, dispatch }`. 액션: `draft/update`, `draft/step`, `draft/reset`, `message/send`(confirmToken), `message/read`, `message/respond` |
| AI adapter | `lib/mind/relationship-demo-adapter.ts` — `RelationshipAdapter { name, isDemo, draftOutgoing(req): Promise<DraftResult> }`, 현재 `relationshipAdapter = relationshipDemoAdapter`(생성 없이 원문을 초안으로 반환) |
| 상태 UI | `components/mind/adapter-status.tsx` `AdapterStatus phase: "demo"\|"idle"\|"loading"\|"success"\|"error"` — 지금은 `"demo"`만 사용 |
| 검증 | 공백 원문 차단, 길이 ≤500, 수신자 필수(본인 제외), 전달 문장 공백 차단(`MindScreen` 내 `isBlank`) |

**분리 원칙(현재 구현됨):** `MindDraft`(개인: rawText·outgoingText)는 `MindMessage`로 복사되지 않는다. `message/send`는 `text = outgoingText.trim()`만 담는다. 초안은 `ownerId`가 같은 인물에게만 보인다.

**UI가 지금 필요로 하는 값**
- 수신함 목록/상세: `MindMessage` 필드 전부. 상세는 상대 구성원 이름·캐릭터(구성원 조회로 해결).
- 전송 응답: 생성된 메시지 id(현재 `crypto.randomUUID()`로 클라이언트 생성 → 서버 id로 교체).
- AI 제안 응답: `DraftResult { mode: "suggested", text, label }` 형태 하나. 현재 UI는 `mode: "manual"`만 쓴다.

**요구사항(서버·AI 연결 시)**
- AI 요청은 **사용자가 제안을 요청할 때만** 보낸다. 현재 "원문을 초안으로 복사" 버튼이 `relationshipAdapter.draftOutgoing`을 부르는 유일한 지점(`RefineStep.copyRaw`)이다. 실제 어댑터를 끼우면 이 버튼이 "제안 받기"가 된다.
- 메시지 전송은 확인 화면(`ConfirmStep`)에서 **명시적 확인 버튼**을 눌렀을 때만(`confirmToken`으로 1회).
- 원문·초안을 수신함 응답, 알림 페이로드, URL, 로그(서버 로그 포함), 분석 이벤트에 넣지 않는다. 프론트는 `console`·`localStorage`·`fetch`를 쓰지 않음을 확인했다.
- **현재 구현 여부:** AI 지연 표시(`loading` 단계) — UI 준비됨, 호출 없음. 실패·재시도(`error` 단계 + 안내 문구) — UI 준비됨, 재시도 버튼 없음(추가 필요). 생성 중 원문 변경 — 원문은 다듬기 단계에서 읽기 전용이라 변경 불가(이전 단계로 돌아가면 제안 결과는 유지되므로 서버 연결 시 "원문이 바뀌면 제안을 무효화"할 규칙 필요). 전송 중 중복 클릭 — `sendingRef` + `confirmToken`으로 차단됨. 네트워크 실패 시 재시도 — 미구현.
- **미해결:** `/inbox/[id]`로 직접 진입하면 '열람함'이 되지 않는다(읽음 처리가 `MindCard` 클릭의 `message/read`에만 있음). 서버 연동 시 **카드 클릭과 직접 진입 모두 상세 조회 시점에 같은 읽음 처리 경로**(예: 상세 조회 응답이 읽음 상태를 바꾸거나, 상세 진입 시 1회 호출)를 쓰도록 한다.

**백엔드 협의 항목:** AI 제안 요청·응답 형식과 소요 시간, 제안 결과 보관 여부(서버에 원문을 보내야 하는지, 보낸다면 보관 금지 정책), 메시지 생성·응답 API, 읽음 처리 방식, 알림 발송 주체.

## 4. 캘린더

| 구분 | 현재 코드 |
|---|---|
| 화면 | `/calendar`(`components/calendar/calendar-route.tsx` → `calendar-screen.tsx`), 홈 요약(`HomeSummary`), 홈 시트(`HomeDetailSheet` `schedule`) |
| 타입 | `lib/calendar/types.ts`: `CalendarEvent { id, title, category: "meal"\|"dining-out"\|"trip"\|"other", date: "YYYY-MM-DD", allDay, startTime: "HH:mm"\|null, endTime, location, memo, participantIds[], createdByMemberId }`, `CalendarDraft`, `CalendarDraftErrors` |
| 제한 | `lib/calendar/config.ts` 제목 40·장소 40·메모 200 |
| provider | `components/calendar/calendar-provider.tsx` — `useCalendar(): { timeZone, today, events, eventsOn(date), eventById, countsByDate, add(event, token), update(id, fields), remove(id) }` |
| 검증 | `lib/calendar/validate.ts` `validateDraft`(공백 제목·날짜 형식·종일 아니면 시작/종료 필수·종료>시작·길이), `draftToEventFields`, `eventToDraft` |
| 로딩·실패 | 없음(동기 메모리). `EmptyState`만 있음 |

**날짜·시간 처리:** 날짜는 문자열 그대로 저장·비교한다(`Date`로 바꾸지 않음). 시간은 `HH:mm`. 표시 시간대는 `CALENDAR_DEFAULT_TIME_ZONE`. 서버도 **date·time 문자열을 그대로 저장**하고 UTC로 변환하지 않아야 홈·달력의 "오늘" 계산(`todayKey`)과 맞는다. 여러 날·반복 일정은 미구현.
**동기화 지점:** 홈 '오늘 일정'과 상세 시트는 `useCalendar()`만 읽으므로, provider의 `events`가 서버 결과로 바뀌면 자동 반영된다. 생성 후에는 `CalendarScreen.handleSubmit`이 `cursor/selected`를 저장한 날짜로 옮긴다.
**UI가 지금 필요로 하는 값:** `CalendarEvent` 전 필드, 생성 응답의 id.
**백엔드 협의 항목:** 가족 시간대 저장 여부, 일정 API·오류 형식, 참여자 응답(수락 여부)은 현재 UI에 없음.

## 5. 추억 사진

| 구분 | 현재 코드 |
|---|---|
| 화면 | `/memories`(`memories-screen.tsx`), `/memories/new`(`memory-new-screen.tsx`), `/memories/[id]`(`memory-detail-screen.tsx`), 홈 '최근 추억' |
| 타입 | `lib/memories/types.ts`: `MemoryPost { id, authorId, memoryDate, caption, createdAt, assetId }`, `MemoryAsset`(blob: objectUrl·mime·width·height·bytes / placeholder) |
| 제한 | `lib/memories/config.ts` 10MiB, JPEG/PNG/WebP, 설명 200자, 홈 3개 |
| 검사 | `lib/memories/image.ts` `inspectImageFile(file)` → MIME·용량·브라우저 디코딩. **서버 측 MIME 스니핑·재인코딩·용량 정책을 대신하지 않는다.** 7단계 검증: Chrome 인코더로 만든 진짜 WebP(RIFF/WEBP, 640×480) 선택→디코딩→등록→상세→홈 통과. JPEG/PNG/손상/초과/GIF/SVG는 5단계에서 통과 |
| provider | `components/memories/memories-provider.tsx` — `useMemories(): { posts, sortedPosts, recentPosts, assetById, postById, draft, pendingAsset, setPendingAsset, clearPendingAsset, resetDraft, addPost(fields, token), removePost(id) }` |
| 렌더 | `components/memories/memory-image.tsx` — 로딩 skeleton·실패 표시 있음. object URL이라 `<img>` 사용 |

**전환 위치**
- 업로드: `MemoryNewScreen.handleFiles` 성공 직후(현재 `setPendingAsset({kind:"blob"...})`)에 서버 업로드를 호출하고, 응답의 자산 id·URL로 `MemoryAsset`을 서버 종류(예: `kind: "remote"`)로 바꾼다. `blob` 자산의 `objectUrl`은 미리보기에만 쓰고 영구 식별자로 쓰지 않는다.
- 게시물 생성: `addPost`가 서버 생성 API를 호출. **실패 시** 이미 업로드된 자산을 정리(삭제 요청 또는 서버 측 고아 자산 정리) — 현재 미구현.
- 업로드 실패 후 재시도: 현재 "사진 교체/선택 취소"만 있음. 재시도 버튼은 미구현.
- 삭제·조회 권한: 서버에서 `authorId`·가족 범위 검증 필요.
- object URL 해제 규칙은 provider 주석대로 유지(등록된 사진은 언마운트로 해제하지 않음).
**UI가 지금 필요로 하는 값:** `MemoryPost` 전 필드, 자산의 표시 URL·width·height·mime.
**백엔드 협의 항목:** 업로드 방식(직접 업로드 vs 서명 URL), 허용 형식·용량, 썸네일 제공 여부, 삭제 시 자산 처리.

## 6. 집안일

| 구분 | 현재 코드 |
|---|---|
| 화면 | `/chores`(`chores-screen.tsx`), `/chores/new`(`chore-new-screen.tsx`), `/chores/[id]`(`chore-detail-screen.tsx`), `/chores/[id]/edit`(`chore-edit-screen.tsx`), 홈 '내 할 일', `/more` 진입 |
| 타입 | `lib/chores/types.ts`: `Chore { id, title, memo, assigneeMemberId, dueDate: "YYYY-MM-DD"\|null, status: "todo"\|"done", createdByMemberId, createdAt, updatedAt, completedAt, completedByMemberId }` |
| 제한 | `lib/chores/config.ts` 제목 40·메모 200 |
| 검증 | `lib/chores/validate.ts` `validateChoreDraft(draft, memberIds)` — 공백 제목·길이·담당자 필수(가족 구성원 id여야 함)·날짜 형식. 직접 테스트 결과(7단계): 41자·201자·공백·미존재 담당자·`2026-02-30` 모두 오류, 40자·200자·`2028-02-29` 통과 |
| 권한 | `lib/chores/permissions.ts` — UI와 `ChoresProvider` 변경 함수가 같은 함수 사용 |
| provider | `components/chores/chores-provider.tsx` — `useChores(): { today, chores, choreById, listChores(status, mine), draft, draftDirty, updateDraft, resetDraft, addChore(fields, token), updateChore(id, fields), setStatus(id, "todo"\|"done"), removeChore(id) }` |

**연동 시 주의**
- 완료는 **목표 상태를 명시**하는 `setStatus(id, status)`다. 서버 API도 토글이 아니라 목표 상태를 받아야 두 번 눌러 되돌아가는 일을 막는다. 완료 시 `completedAt`·`completedByMemberId`는 서버가 기록·반환해야 한다(현재는 클라이언트 시각).
- 0.7초 조작 잠금(`useBusyId`)은 **프론트 편의 장치**다. 서버 중복 요청 방지(멱등 키)·동시 수정 제어(updatedAt 비교 등)를 대신하지 않는다.
- 서버 응답 실패 시: 현재 변경 함수가 동기 boolean을 돌려주며 실패 UI는 없다. 연동 시 `setStatus/updateChore/removeChore`가 Promise를 돌려주고 실패하면 목록 `notice`(`role="status"`) 영역에 오류를 표시하고 상태를 되돌리는 처리가 필요하다.
- 담당자 지정은 "수락 아님"으로만 표시한다. 수락·알림은 미구현.

## 7. 홈 요약

`components/home/home-summary.tsx`는 `useCalendar()`(오늘 일정 2개), `useChores()`(현재 인물 미완료 2개), `useMemories()`(최근 3개)를 읽는다. 별도 데이터 원본이 없으므로 각 provider만 서버로 바꾸면 된다. `lib/home.fixture.ts`에 남은 것은 가족·구성원·알림(가상) 뿐이다. 알림 시트(`HomeDetailSheet` `notifications`)의 `data.notifications`는 **가상 배열**이며 실제 알림 API는 미정.

## 8. 연동 완료 기준 체크리스트 (현재 충족 여부)

| 기준 | 현재 |
|---|---|
| 실제 계정 2개로 같은 가족에 참여 | ❌ 미구현(인증·가족 가입 없음) |
| 한 계정이 등록한 일정·사진·집안일을 다른 계정에서 조회 | ❌ 미구현(같은 탭 메모리 안에서 인물 전환으로만 시뮬레이션) |
| 새로고침·다시 로그인 후에도 서버 데이터 유지 | ❌ 미구현(새로고침 시 초기화) |
| 실제 자유 입력으로 AI 제안 생성, 작성자가 수정·확인 후 전달 | ❌ AI 미연결(수정·확인·전달 UI 흐름은 구현됨) |
| 수신자는 최종 전달 문장만 확인, 원문·초안 조회 불가 | ◐ 프론트 데이터 분리는 구현됨, 서버 차단은 미구현 |
| 다른 가족 데이터·타인의 개인 초안 서버 차단 | ❌ 미구현 |
| 직접 URL 진입·느린 응답·실패·재시도·중복 클릭 처리 | ◐ 직접 진입 안내·중복 클릭 차단은 구현, 느린 응답·실패·재시도 UI는 미구현(`/inbox/[id]` 직접 진입 읽음 처리 미해결) |
| 휴대폰 브라우저에서 입력·사진 선택·키보드·하단 버튼 확인 | ❌ 미검증(헤드리스 브라우저 시뮬레이션만) |

## 9. 백엔드 팀 확인 질문 (최대 5개)

1. **인증:** 로그인 방식(세션 쿠키 vs 토큰)과 프론트가 받는 사용자 id·가족 id·구성원 목록의 형태는?
2. **가족 식별:** 가족 생성·초대·가입 흐름은 서버가 제공하나, 프론트가 만들어야 하나? 한 사용자가 여러 가족에 속할 수 있나?
3. **API·오류 형식:** 일정·사진·집안일·메시지의 생성/수정/삭제 응답과 오류(권한·검증·충돌) 형식은? 멱등 키나 `updatedAt` 비교를 지원하나?
4. **AI·메시지 흐름:** AI 제안 요청에 원문을 서버로 보내야 하나? 보낸다면 보관·로그 정책은? 제안 응답 시간과 실패 시 재시도 규칙, 메시지 읽음 처리 API는?
5. **사진 업로드:** 직접 업로드 vs 서명 URL, 허용 형식·용량, 썸네일·원본 URL 제공 방식, 게시물 생성 실패 시 업로드 자산 정리 책임은?
