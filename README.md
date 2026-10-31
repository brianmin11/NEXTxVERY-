# Family OS · Relationship AI 통합

기존 프론트 `민경민@ef47b6a`에 실제 두 계정의 요청 전달 → AI 조율 → 전원 수락 → 기존 일정 한 건의 변경·저장을 연결한 별도 통합 브랜치다. 이후 추가된 최신 프론트 기능 전체를 통합한 버전은 아니다.

## 로컬 실행

Node 24.15 이상에서 `npm ci` 후 `.env.example`을 참고해 gitignored `.env.local`을 설정한다. 인증 secret은 충분히 긴 임의 값으로 만든다.

```sh
npm run build
node scripts/start-local.mjs --production
```

PORT와 BETTER_AUTH_URL을 같은 로컬 주소로 설정한다. 모델 키는 서버 환경으로만 공급한다. 기존 키 파일은 `OPENAI_KEY_ENV_FILE=/absolute/path/.env.local`로 명시할 수 있다. 실모델 사용은 승인된 합성 검증 범위와 영속 예산 제한을 적용한다.

서로 다른 브라우저 프로필에서 계정 두 개를 만들고, 더보기에서 가족을 생성·초대한다. 일정 등록 후 홈의 마음 전하기에서 개인 표현 정리, 공유 문구 확인·전달, 상대 응답, 공동 조율, 실행 내용 확인, 각자 수락, 우리집에 반영 순서로 진행한다.

## 검증

```sh
npm run lint
npm run typecheck
npm test --workspace @family-os/relationship-ai
npm run test:host
npm run test:e2e
```

브라우저 검사는 실행 중인 로컬 서버와 설치된 Chrome을 사용한다. `scripts/verify-live.mjs`는 **유료 합성 검증용 별도 실행 도구**이며 일반 검사에 자동 포함하지 않는다. 재실행 전에 승인 범위와 남은 예산을 확인한다.

최종 증거: 엔진 92개, 호스트 10개, 키 없는 브라우저 3개 통과. 실모델 두 계정 흐름 및 서버 재시작 후 저장 유지 확인. 실모델 10호출의 관측 토큰 기준 비용 추정은 $0.107672다.

[구현·검증 상세](docs/INTEGRATION-IMPLEMENTED.md) · [원래 흐름 설계](docs/PRODUCT-FLOW.md) · [검증 증거](evidence/)

SQLite는 로컬 영속 저장용이다. 외부 DB 전환과 공개 배포는 수행하지 않았다. 반복 일정·가사·외부 알림 실행, 장기 기억, 개인 기록 삭제 관리, 최신 프론트 전체 연동은 별도 범위다.
