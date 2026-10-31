@AGENTS.md

## 디자인 규칙
- 컴포넌트는 반드시 shadcn/ui로 구성. 직접 div로 버튼/카드 만들지 않는다.
- 팔레트: 모노크롬(neutral 스케일)만. 액센트 컬러는 최대 1개, 꼭 필요할 때만.
- 톤: 실리콘밸리 SaaS급(Linear/Vercel/Raycast) + 애플급 디테일.
- 타이포: 헤드라인 Cal Sans(font-display), 본문 Inter(font-sans).
  위계는 size·weight·letter-spacing·color 네 가지로만 만든다.
- 여백은 4px 그리드, radius는 CSS 변수(--radius) 하나로 통일.
- 모든 인터랙티브 요소에 hover/focus-visible/active/disabled 상태 구현.
- 트랜지션은 150~200ms ease-out, 과한 애니메이션 금지.
- 그림자 최소화. 경계는 border-neutral-200/800 으로.
- 빈 상태·로딩(skeleton)·에러 상태 빠뜨리지 않는다.
- UI 작업 전에 ui-ux-pro-max 스킬의 search.py로 관련 가이드를 먼저 조회한다.
  (`python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain <domain>` / `--stack nextjs` / `--stack shadcn`)
- 새 페이지/컴포넌트 완성 후 반드시 ui-ux-pro-max 체크리스트로 자체 리뷰.

### 프로젝트 고정 사항
- 로고는 `public/logo.svg` 하나만 사용하고, 반드시 `<Logo />`(`components/logo.tsx`)로 렌더한다. 로고 변형 파일을 만들지 않는다. 파비콘(`metadata.icons`)과 OG(`app/opengraph-image.tsx`)도 같은 파일을 쓴다.
- 폰트: `--font-display`(Cal Sans, `public/fonts/CalSansVF.woff2`), `--font-sans`(Inter). Tailwind v4라 `tailwind.config` 대신 `app/globals.css`의 `@theme inline`에서 `font-display`/`font-sans`를 매핑한다.
- shadcn 컴포넌트 추가는 `npx shadcn@latest add <name>` 또는 shadcn MCP(`.mcp.json`)를 사용한다.
