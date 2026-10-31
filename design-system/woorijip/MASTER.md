# 우리집 디자인 기준 (MASTER)

이 문서는 우리집의 **유일한 공통 디자인 기준**이다.
- 구현 원본: `app/globals.css`(토큰), `components/ui/*`(shadcn), `components/woorijip/*`(공통 조각).
- 확인 화면: 개발 서버의 `/design-system`(가상 데이터, 프로덕션 404).
- 페이지별 문서(`design-system/woorijip/pages/<page>.md`)는 **콘텐츠와 배치만** 다룬다. 전역 색·폰트·버튼·카드·radius·그림자를 다시 정의하거나 덮어쓰지 않는다. 바꿔야 하면 이 문서와 토큰을 먼저 고친다.

## 1. 방향

따뜻하고 읽기 쉬운 가족 서비스. 두 영역으로 나눈다.

| 영역 | 무엇 | 규칙 |
|---|---|---|
| **기능 UI** | 일정·사진·가사·설정·폼·대화창 | 크림 바탕, 흰 라운드 카드, 짙은 글자, 초록 주 버튼. 단일 열. 절제된 깊이 |
| **장면** | 집·캐릭터·정원 일러스트 | 장식 팔레트, 부드러운 깊이(`shadow-scene`), 장면 모션 토큰 허용 |

레퍼런스는 구조만 참고한다(이미지·로고·캐릭터·문구 복사 금지).
- 앱 UI 주 레퍼런스: 크림 바탕 + 흰 카드 + 초록 버튼 + 단일 열 + 하단 4탭.
- AI 결과: 항목별로 검토하고 수정한 뒤 반영한다.
- 캐릭터 영역 바로 아래에 실용적인 일정 카드를 둔다.
- 마음 전달: **비공개 원문**과 **전달용 문장**을 분리한다. 전달은 작성자의 승인으로만 일어난다. 상대의 속마음을 추정하는 기능은 만들지 않는다.
- 탐색 구조: 기능 탐색 → 작업 → 선택 항목 상세. 모바일에서는 화면 전환이나 바텀시트로 풀고, 데스크톱 다중 컬럼을 축소 복사하지 않는다.

## 2. 색 (라이트 기준, WCAG 대비 실측)

| 토큰 | 값 | 용도 | 대비 |
|---|---|---|---|
| `background` | `#F7F5EF` | 앱 바탕(크림) | — |
| `card` / `popover` | `#FFFFFF` | 카드·시트 | — |
| `foreground` | `#2E342F` | 본문 | 11.7:1 (bg), 12.7:1 (card) |
| `muted-foreground` | `#626B63` | 보조 문구 | 5.1:1 (bg), 5.5:1 (card), 4.7:1 (secondary) |
| `primary` | `#426B50` | 주 버튼·활성 탭·링크 | 흰 글자 6.1:1, bg 위 글자 5.6:1 |
| `primary-foreground` | `#FFFFFF` | 주 버튼 글자 | — |
| `secondary` / `accent` | `#E8EEE4` | 보조 버튼·hover·강조 상자 | 본문 10.8:1 |
| `muted` | `#EFEDE6` | skeleton·이미지 자리·원문 상자 | — |
| `border` | `#DDE3DA` | 카드·구분선(장식적 경계) | 1.3:1, 정보 전달용 아님 |
| `input` | `#7E897F` | 입력 테두리·점선 빈 상태 | 3.6:1 (card), 3.3:1 (bg) |
| `ring` | `#426B50` | 포커스 링 | — |
| `destructive` | `#B3402E` | 위험·오류 | 흰 바탕 5.7:1, 10% 배경 위 4.8:1 |

**조정 기록**
- `border #DDE3DA`는 1.3:1로 흐려서 입력 경계로 쓸 수 없다(WCAG 1.4.11은 3:1 요구). 그래서 입력 전용 `input #7E897F`를 분리했다. 카드 경계는 장식이라 원래 값을 유지한다.
- `destructive`는 시작 팔레트에 없어서 따뜻한 벽돌색 `#B3402E`로 정했다.
- `muted #EFEDE6`은 크림보다 한 단계 진한 면이다. 이 위에는 본문색(`foreground`)만 쓴다.

**장식 팔레트(장면·아바타 전용):** `deco-apricot #F2B7A0`, `deco-sky #B8DCEC`, `deco-butter #F5D98A`
- 이 위의 글자는 반드시 `foreground`로 쓴다(7.3~9.2:1).
- **흰 글자 버튼 배경이나 작은 글자색으로 쓰지 않는다**(흰 글자는 1.7:1로 실패).
- 페이지마다 새 팔레트를 만들지 않는다.

**장면 팔레트(`--scene-*`, 집·캐릭터 장면 전용):** sky `#E9F2F7`, grass `#CFE2BF` / dark `#B3CF9F`, wall `#FFF8EC` / shade `#EAD9BF`, roof = apricot / shade `#D8927A`, wood `#B98A5E`, window = butter, leaf `#86B07C` / dark `#628F5C`, fence `#F6EFE2`, shadow `rgb(46 52 47 / .12)`, sun = butter. 기능 UI에서는 쓰지 않는다. 장면 안의 글자(이름표)는 `card` 바탕 위 `foreground`만 쓴다.

**색만으로 상태를 구분하지 않는다.** 오류·수락·완료·활성은 항상 문구나 아이콘을 함께 쓴다. 예: 오류는 `AlertCircle` + 문장, 활성 탭은 색 + 굵기 + 표시줄 + `aria-current`.

## 3. 타이포그래피

| 토큰 | 폰트 | 용도 |
|---|---|---|
| `font-sans` | **Pretendard Variable**(로컬, OFL) → 시스템 한글 폰트 | 본문·UI 전체 기본 |
| `font-heading` | Pretendard | 카드·시트 제목(shadcn 내부) |
| `font-display` | Cal Sans → Pretendard | 영문·숫자가 들어간 대표 헤드라인, 브랜드 영역. 한글은 Pretendard로 넘어간다 |
| `font-mono` | Geist Mono | 코드·기술 표기에만. 일반 날짜·숫자에는 `tabular-nums`를 쓴다 |

- 파일: `public/fonts/PretendardVariable.woff2`(v1.3.9 공식 배포), `Pretendard-Bold.subset.woff`(OG 이미지 전용, Satori가 woff2를 못 읽음), `CalSansVF.woff2`. 라이선스 파일을 함께 둔다.
- 스케일(모바일): 화면 제목 30px/bold/tight, 섹션 제목 20~24px/bold, 카드 제목 16~18px/semibold, **본문 16px/1.625**, 보조 14px, 라벨 최소 12px(탭 라벨만).
- 위계는 크기·굵기·자간·색으로만 만든다.
- 한국어 줄바꿈: 전역 `word-break: keep-all` + `overflow-wrap: anywhere`로 어절 단위 줄바꿈과 긴 URL 넘침을 함께 처리한다.
- 입력 글자는 항상 16px. 16px보다 작으면 iOS가 확대한다.

## 4. 간격·크기·radius

- 4px 그리드(Tailwind spacing 단위). 예외: 1px 경계선, 폰트 광학 보정, 일러스트 좌표.
- 페이지 가로 여백 16px(`px-4`). 섹션 간격 40px, 카드 내부 20px(`--card-spacing`).
- `--radius: 1rem` 하나에서 파생한다. 버튼·입력은 `rounded-md`(12.8px), 카드는 `rounded-xl`, 시트 상단은 `rounded-t-2xl`, 칩·아바타는 `rounded-full`. 페이지에서 임의 radius를 선언하지 않는다.
- **터치 영역 최소 44px.** Button `default`(44)·`lg`(48)·`icon`(44)·`icon-lg`(48)를 모바일 기본으로 쓴다. `xs`/`sm`/`icon-xs`/`icon-sm`은 데스크톱·밀집 영역 전용이다.
- shadcn 기본값을 모바일 기준으로 조정한 항목(`components/ui`): TabsList 52px(트리거 45px), Select 트리거 44px, Switch는 시각 32×18이지만 `::after`로 히트 영역 46px, 텍스트 링크 버튼(`variant="link"`)은 `h-11`로 감싼다. 텍스트 입력은 44px, textarea는 그 이상.
- **4px 그리드 예외:** 달력 칸 간격은 2px(`month-grid.tsx`)다. 360px에서 7열 칸이 44px 이상이 되게 하기 위한 예외이며, 다른 곳의 간격은 4px 그리드를 유지한다.

## 5. 깊이·모션

- 그림자: `shadow-card`(카드, 그리고 select·dropdown처럼 떠 있는 메뉴 내용에 `ring-1 ring-border`와 함께), `shadow-sheet`(바텀시트). 버튼·입력·스위치·탭 활성 상태는 그림자 없이 경계(`ring-border`/`border-border`)로 구분한다. shadcn 기본 `shadow-xs/sm/md/lg`는 쓰지 않는다. `shadow-scene`은 장면 전용이다.
- UI 전환: `--motion-duration-ui` 180ms + `ease-ui`(ease-out). Tailwind 기본 transition에 연결돼 있다.
- 장면 효과: `--motion-duration-scene` 400ms + `ease-scene`. 장면 컴포넌트에서만 쓴다.
- `prefers-reduced-motion`이면 모든 전환과 애니메이션이 사실상 0이 된다. 스피너는 `motion-safe:animate-spin`.
- 복잡한 애니메이션은 별도 합의 없이 추가하지 않는다.

## 6. 컴포넌트

**shadcn(설치됨, `components/ui`)**: button, card, input, textarea, label, switch, select, dialog, dropdown-menu, sheet, tabs, badge, separator, skeleton, tooltip. 버튼·입력·카드·대화창·시트는 반드시 이것을 쓴다. 추가는 `npx shadcn@latest add <name>`(파일만 추가, 패키지 변경 없음).

**native `<button>` 허용 예외(의미 있는 전용 구조에만):**
| 위치 | 이유 | 지켜야 할 조건 |
|---|---|---|
| `components/calendar/month-grid.tsx` 날짜 칸 | `role="grid"`/`gridcell` 구조 안에서 7열 칸 크기·선택 상태를 직접 다룬다 | `type="button"`, `aria-label`(날짜·요일·오늘·일정 개수), `aria-pressed`(선택)·`aria-current="date"`(오늘), `min-h-11`+`aspect-square`, hover/active/focus-visible 링 |
| `components/home/family-house-scene.tsx` 캐릭터 히트 영역 | SVG 장면 위에서 그림·이름표와 함께 움직이는 투명 래퍼 | `type="button"`, `aria-label="{이름} 프로필 보기"`, 폭 ≥44px(`min-w-11`), hover/active/focus-visible 링, 장식 SVG는 `aria-hidden` |
그 밖의 일반 버튼·링크 버튼은 shadcn `Button`(`asChild` 포함)을 쓴다.

**우리집 공통(`components/woorijip`)**
| 컴포넌트 | 용도 |
|---|---|
| `MemberAvatar` / `MemberStack` / `MemberChip` / `MemberProfile` | 구성원 표시. 색은 `tone`(apricot·sky·butter·sage)으로만 지정 |
| `ScheduleCard` / `ScheduleCardSkeleton` | 일정 카드와 같은 크기의 로딩 자리 |
| `PhotoCard` | 4:3(또는 정사각) 사진 틀 + 캡션(2줄 말줄임) + 올린 사람·날짜(`takenAt` 또는 `dateLabel/dateTime`), 선택 배지 |
| `LeaveDialog` | 작성 화면 공용 유실 확인(계속 작성 / 내용 두고 나가기 / 내용 지우고 나가기) |
| `PrivateNoteCard` | 비공개 원문 ↔ 전달용 문장 분리, 승인 전 미전달 안내 |
| `EmptyState` / `ErrorState` | 빈 상태(무엇이 없는지 + 다음 행동 하나), 오류(`role="alert"` + 아이콘 + 재시도) |
| `BottomNav` | 하단 4탭, safe-area 포함, `aria-current` |

**홈(`components/home`)**
| 컴포넌트 | 용도 |
|---|---|
| `HomeScreen` | /home 조립. `selection` 하나로 `HomeDetailSheet`만 연다(시트 중첩 금지) |
| `FamilyHouseScene` | 오리지널 2.5D SVG 집 장면(시안). 작은 집(장면 폭의 약 35%, `HOUSE_PLACEMENT`)을 뒤쪽 중앙에 고정하고 앞마당에서 캐릭터가 각자 움직인다. `stage`(1~5)로 레이어만 바뀌고 카메라·앵커·비율은 고정. 캐릭터·이름표·클릭 영역은 하나의 `<button>` 래퍼로 함께 움직이고 본체만 좌우 반전한다. 집 앞 표시 인원은 `maxVisible`(기본 4), 나머지는 `+N`. `motionPaused`로 시트 열림을 알린다 |
| `house-layers.tsx` | 하늘·땅·집·우편함·화분·꽃·정원·가랜드 레이어. 장면 좌표계 0 0 400 240, 집 레이어는 집 좌표계(0.75배로 배치) |
| `use-yard-motion.ts` | 단일 rAF 루프. 발 위치는 `YARD`(x 38~362, y 168~218) 안에서만 고르며 집 발자국(x 128~272, y<176)을 지나지 않는다. idle/walking(16/s)/running(44/s, 15%). React 상태 없이 래퍼 transform만 쓰고, 크기 변화는 ResizeObserver로 다시 놓는다. 정지 후 재개 시 경과 시간을 0부터 세어 순간이동하지 않는다 |
| `use-pause-reasons.ts` | 정지 사유 집합(user·hover·focus·pointer·sheet·hidden·offscreen). 하나라도 남아 있으면 멈추고 모두 해제될 때만 재개. reduced-motion이면 기본 정지(user)이며 '움직임 켜기' 버튼으로 바꿀 수 있다 |
| `FamilyAvatar` / `SceneAvatar` | 캐릭터. 렌더러는 `avatar-renderers/basic-round.tsx`(임시 기본형) 하나이며 `family-avatar.tsx`의 `AvatarGlyph` 한 줄로 교체한다. 역할·성별로 외형을 정하지 않는다 |
| `HomeSummary` | CTA → 오늘 일정(압축 행) → 내 할 일 → 최근 추억 |
| `HomeDetailSheet` | 일정(캘린더 상태를 읽고 '캘린더에서 보기')·구성원('{이름}에게 마음 전하기' → 수신자만 미리 선택하고 /mind로)·가족 목록·알림('마음 수신함 열기')을 담는 단일 바텀시트. 마음 전하기 CTA 자체는 /mind 링크다 |
| `AppShell` / `AppBottomNav` / `ComingSoon` (`components/woorijip`) | 하단 탭 화면 틀, pathname 기반 활성 탭, 준비 중 화면 |

**마음 전하기(`components/mind`, `lib/mind`)** — 프론트 데모. 실제 AI·저장·알림·권한 검증은 없다.
| 조각 | 역할 |
|---|---|
| `lib/mind/types.ts` | `MindMessage`(공유: id·fromId·toId·text·createdAt·status·response)와 `MindDraft`(개인: rawText·outgoingText·step·confirmToken). 원문은 메시지에 어떤 필드로도 넣지 않는다 |
| `lib/mind/config.ts` | `MIND_MAX_LENGTH`(500)·`MIND_REPLY_MAX_LENGTH`(300). 임시 프론트 제한이며 UI 글자 수와 검증이 같은 값을 쓴다 |
| `lib/mind/relationship-demo-adapter.ts` | AI 연결 지점. 데모 어댑터는 생성하지 않고 원문을 편집 초안으로 돌려준다. 실제 연결 시 `relationshipAdapter` 한 줄 교체. API URL·키는 넣지 않는다 |
| `MindProvider` | 루트 레이아웃의 메모리 상태(메시지·초안). 현재 인물은 `DemoViewerProvider`에서 읽고, 초안은 작성한 인물(ownerId)에게만 보인다. 라우트 이동 중 유지, 새로고침 시 초기화. 같은 확인 토큰으로는 한 번만 전송 |
| `/mind` (`MindScreen`) | 전체 화면 4단계: 작성(수신자·원문) → 다듬기(원문 읽기 전용 + `AdapterStatus` demo + 직접 작성) → 확인(수신자·최종 문장 재표시, 명시적 확인) → 완료('데모 수신함에 추가했어요'). 하단 탭 없음, 바닥 고정 버튼 |
| `/inbox`, `/inbox/[id]` | 받은/보낸 탭, 카드(상대·전달 문장·시각·상태), 상세에서 답장·나중에·지금은 어려워요. 열람(read)은 응답이 아니다. 데모 인물 전환은 로그인이 아니며 전환 시 초안을 비운다 |
| `use-return-focus.ts` | 트리거 없이 여는 Dialog의 포커스 복귀. 복귀 대상이 사라지면 fallback으로 |

**가족 일정(`components/calendar`, `lib/calendar`)** — 프론트 데모. 실제 DB·외부 캘린더 동기화·알림은 없다.
| 조각 | 역할 |
|---|---|
| `lib/calendar/types.ts` | `CalendarEvent`(id·title·category·date·allDay·startTime·endTime·location·memo·participantIds·createdByMemberId), 유형 enum·라벨 한 곳 |
| `lib/calendar/config.ts` | 제목 40·장소 40·메모 200자(임시 프론트 제한), 데모 기본 시간대 Asia/Seoul |
| `lib/calendar/date.ts` | 날짜는 `YYYY-MM-DD`, 시간은 `HH:mm` 문자열. 날짜 전용 값은 UTC 정오로만 포맷해 하루가 밀리지 않는다. 월 격자·월 이동·오늘 계산 |
| `lib/calendar/validate.ts` | 제목 공백·날짜 형식·시간 역전 검증. 모르는 값을 자동으로 채우지 않는다 |
| `lib/calendar/fixture.ts` | 오늘 기준 seed 5개(홈 '오늘 일정'과 같은 원본). 한 번만 만든다 |
| `CalendarProvider` | 메모리 일정 상태, 저장 토큰으로 연타 중복 방지, 개발 환경 `?today=YYYY-MM-DD`로 오늘 고정 |
| `/calendar` | 월간 7열 달력(칸 44px, 일정 점 + 접근 가능한 개수), 선택 날짜 목록, 상세 시트(작성자만 수정·삭제: 데모 규칙), 추가·수정 폼 시트(최대 92dvh, 유실 확인), 삭제 확인 |
| `DemoViewerProvider` (`components/demo`) | 모든 데모 기능이 공유하는 현재 인물. 마음 전하기 초안은 작성한 인물에게만 보인다 |

- 하루짜리 일정만 다룬다. 여러 날·반복·시간대 변환은 후속 범위다. 전달받은 마음을 일정에 자동으로 넣지 않는다.

**가족 추억 사진(`components/memories`, `lib/memories`)** — 프론트 데모. 실제 업로드·저장·가족 공유·AI 분석은 없다.
| 조각 | 역할 |
|---|---|
| `lib/memories/types.ts` | `MemoryPost`(id·authorId·memoryDate·caption·createdAt·assetId)와 `MemoryAsset`(blob: object URL / placeholder: 합성 예시)을 분리. blob URL은 탭 안 임시 주소이며 서버의 영구 식별자가 아니다 |
| `lib/memories/config.ts` | 10MiB·JPEG/PNG/WebP·설명 200자(임시 프론트 제한). 프론트 검증은 서버 보안 검증을 대신하지 않는다 |
| `lib/memories/image.ts` | MIME → 용량 → 브라우저 디코딩 순으로 검사해 미지원·용량 초과·손상을 구분. 성공 시 object URL 발급 |
| `lib/memories/fixture.ts` | 오늘 기준 seed 2개. 프로젝트에 사진 자산이 없어 로컬 합성 SVG '예시 이미지'를 쓴다. 외부 사진을 가져오지 않는다 |
| `MemoriesProvider` | 메모리 상태(게시물·자산·초안). object URL 해제는 이벤트 핸들러에서만: 교체·취소된 임시 사진, 삭제된 게시물. 등록된 사진은 화면 언마운트로 해제하지 않는다. 등록 토큰으로 연타 중복 방지, 빠른 재선택은 요청 번호로 이전 결과 폐기 |
| `/memories` | 2열 목록(`PhotoCard` 정사각 타일, 추억 날짜 내림차순 → 등록 시각 내림차순), 빈 상태, 로딩 skeleton·실패 표시(실패 카드도 상세로 이동 가능) |
| `/memories/new` | 전체 화면 등록 폼: 기기 파일 선택기 → 검사·미리보기 → 교체/취소 → 날짜(필수)·설명(선택) → '추억 등록'. 유실 확인은 공용 `LeaveDialog`(마음 전하기와 동일) |
| `/memories/[id]` | 원본 비율 전체 표시(`object-contain`), 날짜·설명·작성자, 작성자만 삭제(프론트 데모 규칙), 삭제 확인 후 목록으로. 없는 ID는 '이 추억을 찾을 수 없어요' |
| `MemoryImage` | 로딩·실패 상태를 가진 사진 렌더. object URL(blob:)은 next/image 로더를 쓸 수 없어 `<img>`를 쓴다. 서버 업로드가 생기면 next/image로 바꾼다 |

- 게시물당 사진 1장. 여러 장·영상·댓글·좋아요·편집·EXIF 위치·얼굴 분석은 하지 않는다.
- 홈 '최근 추억'은 같은 provider의 등록 시각 내림차순 3개와 '전체 보기'다.
- 새로고침 초기화와 데모 인물 전환은 실제 인증·저장·가족 공유가 아니다.
- 홈은 오늘 일정을 시간순 2개만 보여주고 '전체 보기'로 /calendar에 연결한다.
- 사용자가 쓰지 않은 시간·약속·사과를 자동으로 덧붙이지 않는다. '예시 흐름'은 합성 예시로 표시하고 작성 중인 내용을 묻지 않고 덮어쓰지 않는다.
- 마음 전하기 진입: 홈 CTA(`/mind`), 프로필 시트의 '{이름}에게 마음 전하기'(수신자만 미리 선택), 알림 시트의 '마음 수신함 열기'.
- 캐릭터 움직임은 시각 연출일 뿐이다. 접속 여부·감정 상태·활동량으로 설명하지 않는다. 점프·충돌 반동·층간 이동은 없다.
- 집 상태 산정 정책은 미정이다. AI 화목도 계산이나 개인 대화·미접속·집안일 미완료를 벌점으로 연결하지 않는다. 5단계(작은 집 → 화분 → 꽃 → 정원 → 가랜드·무지개)는 미리보기 시안이며 `/design-system`에서만 바꿔 본다. 오류·로딩 상태로 집을 어둡게 만들지 않는다.
- 일반 레이아웃(`section`, `nav`, `dl` 등)과 집·캐릭터 일러스트는 semantic HTML·SVG·전용 React 컴포넌트로 만든다. 모든 요소를 shadcn으로 억지 구현하지 않는다.
- 날짜·시간 책임 구분: **시각(instant, `Date`/ISO)** 표시는 `lib/format.ts`(ko-KR, Asia/Seoul 고정 — 메시지 작성 시각, 사진 날짜). **날짜 전용 `YYYY-MM-DD`·시간 `HH:mm` 문자열**은 `lib/calendar/date.ts`(Date로 바꾸지 않고 계산, 포맷할 때만 UTC 정오 사용 — 일정). 한쪽 값을 다른 쪽 함수에 넣지 않는다.
- loading 버튼: `disabled` + `aria-busy` + 스피너 + 진행형 문구("저장하는 중").
- 아이콘은 lucide. 장식 아이콘은 `aria-hidden`, 아이콘만 있는 버튼에는 `sr-only` 라벨을 단다.
- 상태 3종(빈 상태·skeleton·오류+재시도)을 빠뜨리지 않는다.

## 7. 모바일 배치

- 390px 기준, 360/390/430px 우선 검증. 콘텐츠 폭은 `max-w-md`(448px) 단일 열이다. PC 확장은 이후 별도로 정한다.
- 높이는 `min-h-dvh`. viewport는 `viewport-fit=cover`, `interactive-widget=resizes-content`(키보드가 열리면 레이아웃이 줄어든다).
- 안전 영역: 상단 헤더 `pt-[env(safe-area-inset-top)]`, 하단 탭·시트·푸터 `pb-[env(safe-area-inset-bottom)]`. 하단 탭이 있는 화면은 본문 아래 여백을 `--bottom-nav-height + safe-area`만큼 둔다.
- **짧은 상세·선택은 바텀시트**(`Sheet side="bottom"`, 최대 85dvh, 내부 스크롤, 닫으면 포커스 복귀).
- **새로 만드는 긴 작성 폼은 전체 화면**으로 만든다(/mind 방식: 자체 헤더 + 바닥 고정 버튼, 하단 탭 없음).
- **임시 예외:** 캘린더 추가·수정 폼은 92dvh 시트(`calendar-screen.tsx`)다. 모바일 실기기에서 키보드가 열렸을 때의 동작 검증이 남아 있으며, 문제가 확인되면 전체 화면으로 옮긴다. 새 폼은 이 예외를 따르지 않는다.
- 하단 탭: 우리집(`/home`) · 일정(`/calendar`) · 추억(`/memories`) · 더보기(`/more`). `APP_NAV_ITEMS` 한 곳에서 관리한다. 마음 전하기는 홈 CTA로 진입한다.
- 집 장면은 `aspect-[5/3]`로 폭에 비례(360→216px, 390→234px, 430→258px), 최대 270px. 오늘 일정이 첫 화면 아래쪽에 일부 보이게 유지한다.

## 8. 테마

- 라이트 고정(`ThemeProvider forcedTheme="light"`). 단축키 테마 전환은 제거했다.
- `.dark` 토큰은 이전 템플릿 값이 그대로 남아 있고 **우리집 기준으로 검증하지 않았다.** 다크를 지원하려면 이 문서에 다크 대비표를 먼저 추가한다.

## 9. 브랜드

- 표시 이름 `우리집`(`BRAND_NAME`). 저장소·패키지 이름은 그대로 둔다.
- 로고 원본은 `public/logo.svg` 하나다(초록 라운드 사각형 + 둥근 지붕 집 + 노란 창문). 렌더는 `<Logo />`로만 한다.
- 파비콘은 `metadata.icons`에서 같은 SVG를 쓰고, 템플릿 `favicon.ico`는 제거했다.
- OG 이미지는 같은 SVG를 data URI로 읽어 Satori로 출력한다.

## 10. 새 화면 체크리스트

1. 이 문서와 `components/woorijip`을 먼저 읽고 재사용한다.
2. 한국어 실제 문구로 360px에서 줄바꿈을 확인한다.
3. 터치 44px, 본문 16px, 포커스 링, hover/active/disabled 상태를 확인한다.
4. 빈 상태·로딩·오류+재시도를 넣는다.
5. 색만으로 상태를 전달하지 않는다.
6. reduced-motion을 확인한다.
7. 전역 토큰을 덮어쓰지 않는다.
