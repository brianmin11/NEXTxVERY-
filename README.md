# Family OS Relationship AI

서버에서 import하는 독립 TypeScript 패키지입니다. 개인 표현 정리 → 검토용 공유 초안 → 호스트가 검증한 공유 카드 → 쟁점·합의 초안 → `ChangePlanDraft`까지 처리합니다. UI·HTTP 서비스·DB·인증·승인 기록·일정 실행·월 과금은 포함하지 않습니다.

```sh
npm ci
npm run typecheck
npm test
npm run example
npm run eval:plan
npm run eval:plan -- --split holdout
```

`example`은 **TEST_ONLY** 응답으로 계약 호출을 보여 줍니다. 자유 입력을 이해하는 실제 경로는 `OpenAIAdapter`이며 테스트 응답으로 자동 대체하지 않습니다. 기본 모델이 자동 선택되지 않으며 서버가 모델과 키를 전달합니다. 평가 CLI에만 비교 후보 `gpt-6.1-sol`을 명시했습니다.

```ts
import {createEngine, createRunner, OpenAIAdapter} from '@family-os/relationship-ai';
const engine = createEngine(createRunner(new OpenAIAdapter(modelId, apiKey)));
const result = await engine.personal(hostPreparedPrivateContext, callOptions);
// ShareCardDraft is private and unapproved. Never cast it into ApprovedShareCard.
// Only your authenticated server can construct approved, current shared projections.
```

- [호스트 연결 계약과 함수별 책임](docs/INTEGRATION.md)
- [실제 모델 평가·사람 검토 절차](docs/EVALUATION.md)
- [실제 실행 결과와 중단 사유](docs/LIVE-EVALUATION.md)
- [공급자 조건·알려진 한계](docs/LIMITATIONS.md)
- [버전 있는 런타임 스키마](src/contracts/index.ts)
- [실행 가능한 예제](examples/offline.ts)
- [개발 사례](eval/development.jsonl) / [별도 holdout](eval/holdout.jsonl)

상태와 실제 검사 결과는 `STATUS.txt`, `evidence/`에 기록합니다. 로컬 자동 검사 통과는 모델 품질·청소년 출시·실제 저장/삭제/승인·관계 개선의 증거가 아닙니다. 원본 조사 자료의 REST 경로·월 호출 수·가격은 이 패키지의 API나 상품 정책으로 채택하지 않았습니다.
