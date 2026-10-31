@AGENTS.md

## 디자인 규칙
- **공통 기준은 `design-system/woorijip/MASTER.md` 하나.** 시각·흐름의 기준은 Figma Make 프로토타입이고, 검증·데이터 처리·접근성·백엔드 교체 지점은 기존 코드를 잇는다. 새 페이지·컴포넌트 작업 전에 MASTER와 `components/woorijip/*`, `components/character/*`를 먼저 읽고 재사용한다.
- 톤: 홈의 가족 공간만 픽셀 게임형, 나머지는 깔끔한 생활 앱. 모바일 퍼스트(390px 기준, 360/390/430px 검증).
- 기능 UI: 크림 바탕·경계선 행 목록·짙은 글자·초록 주 버튼. 색은 `app/globals.css` 토큰만 쓰고 페이지에서 임의 색·radius를 선언하지 않는다. 보조 글자는 `muted-foreground`(대비 보정값), 캡션은 12px 이상.
- 홈 장면: 픽셀 테마 자산(`public/assets/pixel`)은 자체 팔레트를 쓰고 `pixelated`로 그린다. 홈 전용 토큰(`home-*`, `shadow-raised`)은 다른 화면에서 쓰지 않는다. 레퍼런스 이미지의 레벨·재화·미션·감정 상태·타사 캐릭터는 채택하지 않는다.
- 캐릭터는 평소 정지하고 드래그 중에만 반응한다. 드래그에는 항상 버튼·키보드 대체 수단을 둔다. 얼굴 자산은 1종이라 표정 선택지를 만들지 않는다.
- 권한: 가족 공통 테마·초대·가족 이름은 관리자만, 캐릭터는 본인만. 관리자 권한은 역할(엄마·아빠)과 별개다. UI와 provider 변경 함수가 `lib/family/permissions.ts`·`lib/chores/permissions.ts`를 함께 쓴다. 서버 검증을 구현한 것처럼 설명하지 않는다.
- 마음 전하기: 원문·초안과 전달 문장을 분리하고, 최종 수신자·문장을 확인한 뒤에만 전송한다. 실제 AI가 없으면 제안을 미리 채우지 않고 '직접 작성'임을 표시한다. 원문을 관리자·수신자·로그·URL·storage에 넣지 않는다.
- 색만으로 오류·수락·완료·활성을 구분하지 않는다. 문구나 아이콘을 함께 쓴다.
- 버튼·입력·대화창·시트는 설치된 shadcn/ui를 쓴다. 일반 레이아웃과 픽셀 장면은 semantic HTML·`<img>`·전용 React 컴포넌트를 허용한다(MASTER의 native button 예외 표 참고).
- 타이포: 본문·한글 Pretendard(font-sans), 영문 디스플레이 Cal Sans(font-display). 본문 16px, 터치 영역 최소 44px(주 버튼 52px, 입력 52px).
- 여백은 4px 그리드(예외: 1px 경계선·폰트 광학 보정·픽셀 좌표·달력 2px). radius는 `--radius` 하나에서 파생한다.
- 모든 인터랙티브 요소에 hover/focus-visible/active/disabled 상태 구현. 짧은 상세·선택은 바텀시트, 긴 작성·편집 폼은 전체 화면(`FlowPage`).
- UI 전환 180ms ease-out(`--motion-duration-ui`), reduced-motion 지원. 합의 없이 복잡한 애니메이션을 추가하지 않는다.
- 그림자는 `shadow-card`·`shadow-sheet`·`shadow-scene`·`shadow-raised` 토큰만 쓴다.
- 빈 상태·로딩(skeleton)·에러 상태를 빠뜨리지 않고, 데모 데이터의 한계를 화면에 표시한다.
- UI 작업 전에 ui-ux-pro-max 스킬의 search.py로 관련 가이드를 먼저 조회한다(`--domain`은 style/color/ux/typography 등, `--stack nextjs`/`shadcn`). 스킬 추천 때문에 Figma 기준을 되돌리지 않는다.
- 새 페이지/컴포넌트 완성 후 반드시 ui-ux-pro-max 체크리스트로 자체 리뷰.

### 프로젝트 고정 사항
- 로고는 `public/logo.svg` 하나만 사용하고, 반드시 `<Logo />`(`components/logo.tsx`)로 렌더한다. 파비콘(`metadata.icons`)과 OG(`app/opengraph-image.tsx`)도 같은 파일을 쓴다.
- 폰트: `--font-sans`(Pretendard, `public/fonts/PretendardVariable.woff2`), `--font-display`(Cal Sans → Pretendard), `--font-mono`(Geist Mono). Tailwind v4라 `app/globals.css`의 `@theme inline`에서 매핑한다. Figma의 Noto Sans KR·DM Serif Display는 CDN 의존이라 도입하지 않았다.
- 픽셀 자산 출처는 `public/assets/pixel/SOURCE.md`. 카탈로그(`lib/character/catalog.ts`, `lib/scene/themes.ts`)에는 실제 파일이 있는 항목만 등록한다.
- 표시 브랜드는 `우리집`(`BRAND_NAME`). 저장소·패키지 이름은 바꾸지 않는다.
- 앱 테마는 라이트 고정(다크 토큰 미검증). `/design-system`은 개발 전용 확인 페이지(프로덕션 404)이고 가상 데이터만 쓴다.
- 상태 구조: `FamilyProvider`(가족·세션·권한·캐릭터·테마) → `FamilyScope`(가족 id로 마음·일정·사진·집안일 provider 재마운트). 같은 데이터의 원본을 두 군데 만들지 않고, 이름 문자열이 아니라 id로 본인·작성자·권한을 판정한다. 데모 인물·가족 전환은 `DemoViewerSwitch`·`/more` 프로토타입 제어로만 둔다.
- 명령은 WSL(`/home/brianmin11/해커톤`)에서 실행한다. Windows git의 전역 safe.directory 설정은 바꾸지 않는다.
- shadcn 컴포넌트 추가는 `npx shadcn@latest add <name>` 또는 shadcn MCP(`.mcp.json`)를 사용한다.
