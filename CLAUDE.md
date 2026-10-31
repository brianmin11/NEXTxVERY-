@AGENTS.md

## 디자인 규칙
- **공통 기준은 `design-system/woorijip/MASTER.md` 하나.** 새 페이지·컴포넌트 작업 전에 MASTER와 `components/woorijip/*`를 먼저 읽고 재사용한다. 페이지별 문서는 콘텐츠·배치만 다루고 전역 색·폰트·버튼·카드를 덮어쓰지 않는다.
- 톤: 따뜻하고 읽기 쉬운 가족 서비스. 모바일 퍼스트(390px 기준, 360/390/430px 검증).
- 기능 UI: 크림 바탕·흰 카드·짙은 글자·초록 주 버튼. 색은 `app/globals.css` 토큰만 쓰고 페이지에서 임의 색·radius를 선언하지 않는다.
- 집·캐릭터·정원 장면: 장식 팔레트(`deco-*`)와 부드러운 깊이(`shadow-scene`)를 허용한다. 장식색을 흰 글자 버튼 배경이나 작은 글자색으로 쓰지 않는다.
- 색만으로 오류·수락·완료·활성을 구분하지 않는다. 문구나 아이콘을 함께 쓴다.
- 버튼·입력·카드·대화창·시트는 설치된 shadcn/ui를 쓴다. 일반 레이아웃과 집·캐릭터 일러스트는 semantic HTML·SVG·전용 React 컴포넌트를 허용한다. 모든 요소를 shadcn으로 억지 구현하지 않는다.
- 타이포: 본문·한글 Pretendard(font-sans), 영문 디스플레이 Cal Sans(font-display, 한글은 Pretendard로 fallback).
  위계는 size·weight·letter-spacing·color 네 가지로만 만든다. 본문 16px, 터치 영역 최소 44px.
- 여백은 4px 그리드(예외: 1px 경계선·폰트 광학 보정·일러스트 좌표). radius는 CSS 변수(--radius) 하나에서 파생한다.
- 모든 인터랙티브 요소에 hover/focus-visible/active/disabled 상태 구현.
- UI 전환은 150~200ms ease-out(`--motion-duration-ui`). 장면 효과는 별도 모션 토큰(`--motion-*-scene`)으로 관리하고 reduced-motion을 지원한다. 합의 없이 복잡한 애니메이션을 추가하지 않는다.
- 그림자는 카드(`shadow-card`)·시트(`shadow-sheet`)·장면(`shadow-scene`) 토큰만 쓴다. 그 밖의 경계는 `border-border`로 구분한다.
- 빈 상태·로딩(skeleton)·에러 상태 빠뜨리지 않는다.
- UI 작업 전에 ui-ux-pro-max 스킬의 search.py로 관련 가이드를 먼저 조회한다.
  (`python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain <domain>` / `--stack nextjs` / `--stack shadcn`)
- 새 페이지/컴포넌트 완성 후 반드시 ui-ux-pro-max 체크리스트로 자체 리뷰.

### 프로젝트 고정 사항
- 로고는 `public/logo.svg` 하나만 사용하고, 반드시 `<Logo />`(`components/logo.tsx`)로 렌더한다. 로고 변형 파일을 만들지 않는다. 파비콘(`metadata.icons`)과 OG(`app/opengraph-image.tsx`)도 같은 파일을 쓴다.
- 폰트: `--font-sans`(Pretendard, `public/fonts/PretendardVariable.woff2`), `--font-display`(Cal Sans → Pretendard, `public/fonts/CalSansVF.woff2`), `--font-mono`(Geist Mono, 필요한 곳만). Tailwind v4라 `tailwind.config` 대신 `app/globals.css`의 `@theme inline`에서 매핑한다.
- 표시 브랜드는 `우리집`(`BRAND_NAME`). 저장소·패키지 이름은 바꾸지 않는다.
- 테마는 라이트 고정(다크 토큰 미검증). `/design-system`은 개발 전용 확인 페이지(프로덕션 404)이고 가상 데이터만 쓴다.
- 명령은 WSL(`/home/brianmin11/해커톤`)에서 실행한다. Windows git의 전역 safe.directory 설정은 바꾸지 않는다.
- shadcn 컴포넌트 추가는 `npx shadcn@latest add <name>` 또는 shadcn MCP(`.mcp.json`)를 사용한다.
