# 우리집 디자인 기준 (MASTER)

이 문서는 우리집의 **유일한 공통 디자인 기준**이다. 시각·흐름의 기준은 Figma Make 프로토타입(`우리집 가족 앱 프로토타입`, 2026-11-01)이고, 검증·데이터 처리·접근성·백엔드 교체 지점은 기존 코드를 이어 간다.
- 구현 원본: `app/globals.css`(토큰), `components/ui/*`(shadcn), `components/woorijip/*`(공통 조각), `lib/character/catalog.ts`·`lib/scene/themes.ts`(픽셀 자산 카탈로그).
- 확인 화면: 개발 서버의 `/design-system`(가상 데이터, 프로덕션 404).
- 백엔드 연동 준비(실제 타입·provider·교체 지점·미구현 목록): `docs/frontend-integration.md`. 디자인 기준은 이 문서 하나다.
- 페이지별 문서(`design-system/woorijip/pages/<page>.md`)는 **콘텐츠와 배치만** 다룬다. 전역 색·폰트·버튼·카드·radius·그림자를 다시 정의하거나 덮어쓰지 않는다.

## 1. 방향

두 영역으로 나눈다. **홈의 가족 공간만 게임형**, 나머지는 깔끔한 생활 앱이다.

| 영역 | 무엇 | 규칙 |
|---|---|---|
| **홈 장면** | 픽셀 테마 배경 + 레이어 합성 캐릭터 | 자산 자체 팔레트, HUD·이름표는 `home-hud`/`foreground` 위 `card` 글자, `shadow-scene`·`shadow-raised`만 허용 |
| **기능 UI** | 일정·사진·집안일·마음·설정·폼·시트 | 크림 바탕, 경계선으로 나뉜 행 목록, 짙은 글자, 초록 주 버튼. 단일 열. 카드보다 행 목록을 우선 |

- 레퍼런스 이미지(레벨·재화·미션·감정 상태·타사 캐릭터)는 구조만 참고하고 채택하지 않는다. 점수·벌점·화목도·감정 자동 공개를 만들지 않는다.
- 마음 전달: **비공개 원문**과 **전달용 문장**을 분리한다. 전달은 작성자의 명시적 확인으로만 일어난다. 실제 AI가 없을 때 제안을 미리 채우지 않는다.
- 가족 공통 테마는 관리자만 바꾸고, 관리자 권한은 역할(엄마·아빠)과 별개다. 각 구성원은 자기 캐릭터만 바꾼다. 초대코드는 로그인을 대체하지 않는다.
- 캐릭터는 평소 정지해 있고, 잡고 끌 때만 반응한다(자동 걷기·무한 흔들림 없음).

## 2. 색 (라이트 기준, WCAG 대비)

Figma 값을 기본으로 하고 대비가 모자란 값만 보정했다.

| 토큰 | 값 | Figma | 용도 | 대비 |
|---|---|---|---|---|
| `background` | `#F7F5F0` | 같음 | 앱 바탕(크림) | — |
| `card` / `popover` | `#FFFEFA` | 같음(paper) | 시트·입력·프로필 블록 | — |
| `foreground` | `#202521` | 같음(ink) | 본문 | 14.3:1 (bg) |
| `muted-foreground` | `#676C66` | `#747972`(4.4:1 미달) | 보조 문구 12px 이상 | 4.9:1 (bg), 5.1:1 (card) |
| `primary` | `#385F4B` | 같음(green) | 주 버튼·활성 탭·단계 라벨·링크 | 흰 글자 7.2:1, bg 위 글자 6.6:1 |
| `primary-deep` | `#294B3A` | 같음 | 주 버튼 hover, raised 그림자 밑면 | — |
| `secondary` / `accent` | `#DCE8DE` | 같음(green-2) | 안내 상자·선택 배경·참여자 칩 | 본문 11:1, 보조 글자는 14px 이상 |
| `muted` | `#EEECE7` | 같음 | 원문 상자·데모 컨트롤·skeleton | 본문 위만 |
| `border` | `#E5E3DD` | 같음(line) | 행 경계·탭 밑줄(장식) | 정보 전달용 아님 |
| `input` | `#878C85` | `#D7D7D1`(1.4:1 미달) | 입력 테두리·점선 빈 상태 | 3.4:1 (card), 3.2:1 (bg) |
| `ring` | `#385F4B` | — | 포커스 링(3px) | — |
| `destructive` | `#A8483E` | `#B95449`(4.4:1 미달) | 오류·삭제 | 흰 바탕 5.7:1, bg 위 글자 5.3:1 |

**장식 팔레트(`deco-*`)**: apricot `#F2B7A0`, sky `#B8DCEC`, butter `#F5D98A`(이니셜 아바타 배경), coral `#D97661`(새 마음 점·달력 일정 점), sage `#8EAE93`(일정 색 막대). 글자색이나 흰 글자 버튼 배경으로 쓰지 않는다.

**홈 전용 토큰**: `--home-header-from/to`(상단바 그라데이션), `--home-hud`(장면 위 HUD 배경, 흰 글자 ≥ 7:1), `--home-scene-bg`, `--elevation-raised`(마음 전하기 CTA). 다른 화면에서 쓰지 않는다.

**장면 팔레트(`--scene-*`)**: 예전 2.5D SVG 집 시안(`/design-system` 미리보기 전용)에만 남아 있다. 사용자 홈의 픽셀 테마 자산은 자체 색을 가지며, 그 위 글자는 HUD 배경 위 `card` 글자만 쓴다.

**색만으로 상태를 구분하지 않는다.** 오류·수락·완료·활성·새 마음은 항상 문구나 아이콘을 함께 쓴다.

## 3. 타이포그래피

| 토큰 | 폰트 | 용도 |
|---|---|---|
| `font-sans` | **Pretendard Variable**(로컬, OFL) | 본문·UI 전체 |
| `font-display` | Cal Sans → Pretendard | 초대코드·숫자 표기 등 영문 디스플레이 |
| `font-mono` | Geist Mono | 코드·기술 표기에만 |

- Figma는 Noto Sans KR·DM Serif Display(Google Fonts CDN)를 쓴다. 네트워크 의존을 피하려고 로컬 Pretendard를 유지했다. DM Serif Display는 라틴 글리프만 있어 한글 제목에는 적용되지 않으므로 체감 차이는 숫자·영문뿐이다.
- 스케일: 상단바 제목 20px/bold/tight, 흐름 화면 제목 30px/bold/tight, 섹션 제목 16px/bold, **본문 16px/1.625**, 보조 14px, 캡션·라벨 **최소 12px**(Figma의 8~11px은 12px로 올린다). 단계 라벨은 12px/bold/`primary`.
- 입력 글자는 항상 16px. 한국어 줄바꿈은 전역 `word-break: keep-all` + `overflow-wrap: anywhere`.

## 4. 간격·크기·radius

- 4px 그리드. 예외: 1px 경계선, 폰트 광학 보정, 픽셀 자산 좌표, 달력 칸 간격 2px.
- 페이지 가로 여백 16px(`px-4`). 전체 폭 목록·격자·장면은 `AppShell flush`로 뺀다.
- `--radius: 1rem` 하나에서 파생: 입력 `rounded-md`(≈Figma 10~13px), 카드·CTA `rounded-xl`, 시트 상단 `rounded-t-xl`(≈22px), 칩·아바타·HUD `rounded-full`.
- **터치 영역 최소 44px.** Button `default` 44, `lg` 52(Figma 주 버튼), `icon` 44. 입력 52px, textarea 그 이상. 밑줄 탭 48px. 스와치 64px.
- 상단바 76px(`TopBar`), 하단 탭 64px + safe-area, 행 목록 최소 60px, 메뉴 행 68px.

## 5. 깊이·모션

- 그림자: `shadow-card`(떠 있는 메뉴·HUD), `shadow-sheet`(바텀시트·홈 요약 상단), `shadow-scene`(장면 안쪽 음영), `shadow-raised`/`shadow-raised-pressed`(홈 CTA만). 버튼·입력·탭은 경계선으로 구분한다.
- UI 전환 `--motion-duration-ui` 180ms ease-out. 장면 `--motion-duration-scene` 400ms.
- 캐릭터: 드래그 중에만 6px 들어 올림 + 진행 방향 5° 기울기 + 그림자 확대(150ms). `prefers-reduced-motion`이면 반응 없이 위치만 바뀐다. 자동 걷기·대기 흔들림은 없다.
- 복잡한 애니메이션은 별도 합의 없이 추가하지 않는다.

## 6. 컴포넌트

**shadcn(`components/ui`)**: button, card, input, textarea, label, switch, select, dialog, dropdown-menu, sheet, tabs, badge, separator, skeleton, tooltip. 버튼·입력·대화창·시트는 반드시 이것을 쓴다. Tabs 기본 변형은 Figma 밑줄형(활성 = `primary` + bold + 2px 표시줄), `variant="segment"`는 회색 토글.

**native `<button>` 허용 예외:**
| 위치 | 이유 | 조건 |
|---|---|---|
| `components/calendar/month-grid.tsx` 날짜 칸 | `role="grid"` 안의 7열 칸 | `aria-label`(날짜·요일·오늘·일정 개수), `aria-pressed`, `aria-current="date"`, 44px |
| `components/home/pixel-scene.tsx` 캐릭터 | 드래그·탭·방향키를 한 요소에서 받는 투명 래퍼 | `aria-label="{이름} 프로필 보기"`, `aria-describedby` 이동 안내, 44px, focus-visible 링, `touch-action: none` |
| `components/chores/chore-card.tsx` 완료 체크 | `role="checkbox"` | `aria-checked`, 제목이 든 `aria-label`, 44px |
| `components/character/character-form.tsx` 스와치, `theme-screen.tsx` 테마 행, 데모 인물·가족 전환 | `role="radio"` 그룹 | `aria-checked`, `aria-label`, 44px 이상, 선택은 체크 아이콘 + 테두리 |
| `components/woorijip/list-row.tsx` `ListRow onClick` | 행 전체가 누르는 영역 | 포커스 링 inset, 60px 이상 |

**우리집 공통(`components/woorijip`)**
| 컴포넌트 | 용도 |
|---|---|
| `TopBar` / `AppShell` | 76px 상단바(뒤로·작은 라벨·큰 제목·아이콘 버튼), `tone="home"` 그라데이션, `flush`·`hideNav` |
| `FlowPage` / `StepLabel` / `FlowHeading` / `FlowLead` / `PrivacyNote` | 하단 탭 없는 전체 화면 흐름(온보딩·작성·편집). 바닥 고정 버튼, 개인정보·권한 안내 상자 |
| `RowList` / `ListRow` / `MenuGroup` / `MenuRow` / `SectionTitle` | 경계선 행 목록, 더보기 메뉴, 섹션 제목 + '전체' 링크 |
| `MemberAvatar` / `MemberStack` / `MemberChip` | 이니셜 원형(목록·참여자). 색은 `tone`으로만 |
| `LeaveDialog` | 작성 화면 공용 유실 확인(계속 작성 / 두고 나가기 / 지우고 나가기) |
| `EmptyState` / `ErrorState` | 빈 상태(무엇이 없는지 + 다음 행동 하나), 오류(`role="alert"` + 재시도) |
| `BottomNav` / `AppBottomNav` | 하단 4탭(우리집·일정·추억·더보기), `aria-current` |
| `DemoViewerSwitch`(`components/demo`) | 데모 인물 전환 한 줄 바 + 시트. 사용자 기능이 아니다 |

**캐릭터·장면(`components/character`, `components/home`, `lib/character`, `lib/scene`)**
| 조각 | 역할 |
|---|---|
| `lib/character/catalog.ts` | 실제 파일이 있는 항목만: 피부 5·헤어 8·의상 8·소품 5(+없음). 얼굴은 `face_smile` 1종이라 선택지에 없다. `characterLayers(config)`가 의상→몸→얼굴→머리→소품 순서를 돌려준다 |
| `lib/scene/themes.ts` | 테마 5종(햇살 정원·도시의 작은 집·숲속 오두막·벚꽃 언덕집·별빛 테라스), 레이어 `01_sky…04_house` + `05_front`. 비율 13:14 |
| `lib/scene/spots.ts` | 캐릭터 위치(%): x 8~92, y 74~88, 키보드 이동 단위 |
| `PixelCharacter` / `FamilyAvatar` | `<img>` 레이어 5장 + `pixelated`. 목록·시트·프로필 공통 렌더러 |
| `PixelScene` | 배경 4장 → 캐릭터 → 앞 레이어. HUD(테마명·인원), 안내 문구, 드래그·방향키·aria-live. 집 앞 최대 4명(현재 인물 포함), 초과는 '구성원 N명 전체 보기' |
| `use-character-drag.ts` | 포인터 캡처, 7px 이내 탭, 취소(pointercancel·Escape·캡처 상실) 시 원위치 |
| `CharacterForm` / `CharacterEditorScreen` | 미리보기·이름·4개 라디오 그룹(가로 스크롤 스와치). 초안 → 저장/취소 |
| `HouseStagePreview`(`house-layers.tsx`) | 예전 2.5D 집 성장 단계 시안. `/design-system` 전용, 테마와 합치지 않는다 |

**가족·권한(`components/family`, `lib/family`)**: `FamilyProvider`(모드에 따라 `LiveFamilyProvider`=서버 세션 / `DemoFamilyProvider`=메모리), `FamilyScope`(세션 게이트 + 가족 id로 기능 provider 재마운트), `permissions.ts`(관리자: 테마·초대·가족 이름 / 본인: 캐릭터, 서버가 재검증), `InviteSheet`(관리자가 24시간 코드 발급), `ThemeScreen`, `RenameFamilyDialog`, `components/auth/login-screen.tsx`(이메일/비밀번호). 자세한 책임 분리는 `docs/frontend-integration.md`.

**온보딩(`components/onboarding`)**: `/welcome`, `/family/new`(가족 이름 → 내 캐릭터), `/join`(코드 조회 → 가족 확인 → 내 캐릭터). '로그인 완료'처럼 보이는 문구를 쓰지 않는다.

**마음 전하기(`components/mind`)**: `/mind` 3단계(수신자·원문 → 'AI 제안 받기'(라이브에서 명시적 요청 시만) 또는 직접 다듬기 → 전송 전 확인) + 완료. 제안은 편집 가능한 초안으로만 들어가고 라벨로 구분한다. `/inbox` 행 목록, `/inbox/[id]` 상세 진입 시 읽음(수신자만), 답장·나중에·지금은 어려워요. AI 실패·비활성은 `AdapterStatus error` + 직접 작성 안내. 구현은 `components/mind/mind-context.ts` 모양을 데모(`memory-mind-provider`)·라이브(`src/features/live/mind-provider`)가 함께 쓴다.

**가족 일정(`components/calendar`)**: 달력(칸 44px, 선택일 32px 원, 코랄 점), 날짜 행 목록(세이지 막대), 상세 시트, 전체 화면 폼 `/calendar/new`·`/calendar/[id]/edit`. 날짜·시간은 `YYYY-MM-DD`/`HH:mm` 문자열.

**추억 사진(`components/memories`)**: 첫 타일 와이드 2열 격자(그라데이션 위 캡션), 전체 화면 등록(`/memories/new`, 기기 파일 선택·검사·object URL), 상세(원본 비율, 작성자 삭제).

**집안일(`components/chores`)**: 행 목록(원형 체크·'{담당}에게 지정됨 · 날짜'·기한 지남 아이콘+문구), 내 할 일/가족 전체 × 할 일/완료, 전체 화면 추가·수정, 상세. 명시적 `setStatus`, 0.7초 잠금, 권한 함수 공용.

공통 규칙
- 날짜·시간 책임: 시각(ISO/`Date`)은 `lib/format.ts`, 날짜 전용 문자열은 `lib/calendar/date.ts`.
- loading 버튼: `disabled` + `aria-busy` + 스피너 + 진행형 문구. 아이콘은 lucide, 장식은 `aria-hidden`, 아이콘 버튼은 `aria-label`.
- 상태 3종(빈 상태·skeleton·오류+재시도)을 빠뜨리지 않는다. 데이터가 데모면 그 한계를 화면에 표시한다.
- 사용자가 쓰지 않은 내용을 자동으로 덧붙이지 않는다. 예시는 '합성 예시'로 표시하고 작성 중인 내용을 묻지 않고 덮어쓰지 않는다.

## 7. 모바일 배치

- 390px 기준, 360/390/430px 검증. 콘텐츠 폭 `max-w-md`(448px) 단일 열. 데스크톱은 같은 열을 가운데 둔다.
- 높이 `min-h-dvh`, viewport `viewport-fit=cover`, `interactive-widget=resizes-content`.
- 안전 영역: 상단바 `pt-[env(safe-area-inset-top)]`, 하단 탭·시트·바닥 버튼 `pb-[env(safe-area-inset-bottom)]`.
- **짧은 상세·선택은 바텀시트**(`Sheet side="bottom"`, 최대 85dvh, 닫으면 포커스 복귀). **긴 작성·편집 폼은 전체 화면**(`FlowPage`). 캘린더 폼도 전체 화면이며 예전 92dvh 시트 예외는 없앴다.
- 하단 탭: 우리집(`/home`) · 일정(`/calendar`) · 추억(`/memories`) · 더보기(`/more`). 마음 전하기·수신함·온보딩·편집 화면은 탭이 없다.
- 홈 장면은 Figma대로 **13:14**(360→388px, 390→420px, 430→464px)로 폭에 비례하고 270px로 자르지 않는다. 그 아래 요약은 `rounded-t-2xl` + `shadow-sheet`로 겹친다.

## 8. 테마

- 앱 테마는 라이트 고정(`ThemeProvider forcedTheme="light"`). `.dark` 토큰은 검증하지 않았다.
- 가족 공통 테마(홈 장면 배경 5종)는 `FamilyProvider.setTheme`로만 바뀌고 관리자만 가능하다. 테마를 바꿔도 캐릭터·일정·사진·집안일·메시지는 바뀌지 않는다.

## 9. 브랜드·자산

- 표시 이름 `우리집`(`BRAND_NAME`), 로고는 `public/logo.svg` 하나, `<Logo />`로만 렌더.
- 픽셀 자산은 `public/assets/pixel/`(출처 `SOURCE.md`). Figma Make 생성물이며 라이선스 확인은 배포 전 별도로 한다. 참고 이미지의 캐릭터·로고는 복사하지 않는다.

## 10. 새 화면 체크리스트

1. 이 문서와 `components/woorijip`·`components/character`를 먼저 읽고 재사용한다.
2. 한국어 실제 문구로 360px에서 줄바꿈·넘침을 확인한다.
3. 터치 44px, 본문 16px, 캡션 12px 이상, 포커스 링, hover/active/disabled 상태를 확인한다.
4. 빈 상태·로딩·오류+재시도를 넣고, 데모 한계를 표시한다.
5. 색만으로 상태를 전달하지 않는다.
6. reduced-motion과 드래그 대체 수단(버튼·키보드)을 확인한다.
7. 전역 토큰을 덮어쓰지 않는다. 권한은 UI와 provider 변경 함수가 같은 함수를 쓴다.
