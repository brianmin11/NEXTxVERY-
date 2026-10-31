# Backend integration — schema 1.0

## 신뢰 경계

이 패키지는 신뢰할 수 있는 서버에서만 호출한다. 브라우저 JSON의 actorId, householdId, hostVerified:true, participantIds를 그대로 전달하면 안 된다. 타입은 인증을 증명하지 않는다. 호스트는 로그인/멤버십/연령·공급자 처리 조건/목적/수신자/최신 버전/철회 여부를 검사하고 허용된 데이터만 projection한다. 가족 관리자·결제자는 비공개 열람권을 자동으로 갖지 않는다.

호스트는 현재 시각(now)·IANA timezone·permissionEpoch·작업 목적을 정한다. 현재 요청 Source와 후속 기억을 구분한다. historyStored는 저장 상태 설명이며 패키지는 저장하지 않는다. memoryEnabled=false면 후속 기억을 모델 입력과 파생 출처에서 제외한다. 삭제·정정·철회 상태를 최신으로 공급하는 책임은 호스트에 있다.

## 함수 계약

모든 입력은 src/contracts/index.ts의 엄격한 Zod 객체로 검증한다. `examples/contracts.json`은 합성 JSON 예시다. AI 단계는 `{value,metadata,run}`을 반환한다. metadata는 데이터 파생 범위이며 run은 모델 호출 계측이다. 모델 호출이 성공한 뒤 의미 검사에서 함수가 실패할 수 있으므로 호출자는 함수 오류 코드도 함께 기록한다.

| 함수 | 입력 → 출력 | 사전 조건 / 호스트 추가 검사 | 부수 효과 |
|---|---|---|---|
| createEngine(runner).personal | PrivateContext → PersonalResult | current 소유자·수명, 허용 기억, route; 모델 감정 해석은 사용자 확인 필요 | 모델 호출만 |
| .share | PrivateContext + id/revision/recipients/purpose/constraintsOnly → ShareCardDraft | reflect 경로는 공유 요청으로 명시 변경. 결과 검토·수정 후 인증된 승인 필요. 동일 호출에서 위험 판정, 위험이면 POLICY_RESTRICTED | 모델 호출만; 발송 없음 |
| .analyze | JointContext → IssueAnalysis | 유효 ApprovedShareCard와 허용 최소 일정만. 원문·개인 metadata 금지 | 모델 호출만 |
| .propose | JointContext + id/revision → AgreementDraft | ID/버전은 서버 발급. 당사자별 수정·수락·거절·보류 UX는 호스트 | 모델 호출만 |
| .revise | JointContext + SharedPrior + feedback(actorId/instruction/action) → AgreementDraft | SharedPrior는 draft·metadata(shared 범위/출처/유효기간)·contentHash·latestRevision을 포함한다. 호스트가 신뢰 저장소에서 만든 envelope만 전달하며 raw draft는 거부된다. feedback.actorId 인증. 새 버전 수락 별도 | revise는 모델 호출; defer/decline은 순수 코드 |
| compileChangePlan | AgreementDraft + JointContext → ChangePlanDraft | 같은 최신 공유 입력; ambiguous/null/proposed 조건은 blockers 검토. 실행 전 현재 버전과 각 당사자 수락 재검증 | 없음 |
| verifyAcceptanceVersion | ChangePlanDraft + agreementId/revision/semanticHash → boolean | 단순 일치 검사. true여도 인증·권한·당사자 전체 수락을 증명하지 않음 | 없음 |
| invalidatedArtifacts | {id,revision,metadata}[] + 변경 출처[] → 영향받는 배열 인덱스 | 파생 lineage를 유지; 삭제/철회/정정/새버전 전파. 독립 승인 합의는 별도 정책 | 없음; DB 삭제 아님 |

## 입력·출력 예시 위치

`examples/contracts.json`에 PrivateContext, JointContext, PersonalResult, ShareCardDraft, IssueAnalysis, AgreementDraft, ChangePlanDraft, revise feedback, acceptance 비교, lineage 예시를 저장한다. 테스트에서 이 예시 스키마를 확인한다. 임의 route·ID·시간을 제품 기본값으로 사용하지 않는다.

## 오류와 재시도

RelationshipError.code만 일반 로그에 기록한다. 원문·감정·API 원시 에러·모델 내부 추론을 로깅하지 않는다.

| 코드 | 처리 | 자동 재시도 |
|---|---|---|
| INPUT_INVALID | 입력 스키마/ID/시간대 수정 | 아니오 |
| CLARIFICATION_REQUIRED | 정보 부족; unknown/null/blockers도 함께 사용 | 아니오 |
| POLICY_RESTRICTED | 처리 제한·비공개 지원 경로, 공유 원인 비노출 | 아니오 |
| MODEL_REFUSAL | 거절을 실패로 명시 | 아니오 |
| TIMEOUT / CANCELLED | 중단, 사용량이 모르면 null | 아니오 |
| RATE_LIMIT | 호출 한도·시간·비용 안에서 제한 재시도 | retryable=true일 때만 |
| TRUNCATED / SCHEMA_INVALID | 잘린/형식 불일치 출력 폐기 | 아니오 |
| SEMANTIC_INVALID | 출처·담당자·날짜 등 의미 조건 위반 | 아니오 |
| BUDGET_EXCEEDED | 호출 전 예산 부족 또는 관측 사용량 초과 | 아니오 |
| STALE_CONTEXT | 최신 권한·공유·출처를 다시 읽고 새 요청 | 아니오 |
| PROVIDER_ERROR | SDK 원시 메시지는 노출하지 않음 | 일시 네트워크/5xx만 제한 재시도 |

추가 질문은 최대3개, 반복 질문 회차 2 이상에서 질문 대신 미확인으로 남긴다. 즉시 재시도에는 backoff가 없으므로 지속 429는 호스트 큐에서 지연시킨다. 이 패키지를 무한 반복 호출해 제한을 우회하지 않도록 월 사용량/동시 요청 예약을 서버가 관리한다.

## 호출 예산

RunOptions는 maxCalls/maxRetries/maxInputBytes/maxOutputTokens/timeoutMs/maxCostUsd/signal/price를 받는다. 단가 버전이 없으면 비용 상한을 집행할 수 없어 호출을 거부한다. UTF-8 입력 바이트와 스키마·지침, framing 여유로 보수적 토큰 예산을 예약한다. 이는 공급자 청구 보장이 아닌 추정 상한이다. 실패한 시도는 예약액을 환급하지 않는다. 알 수 없는 청구 토큰/비용은 null, usageComplete=false이며 0으로 표기하지 않는다. 공급자 가격 변경·지역 할증·캐시 쓰기 등의 조건은 호스트가 단가표에 반영한다.

maxCalls는 함수 한 번의 모델 단계에 적용된다. 여러 함수를 묶은 전체 흐름과 동시 요청 예산은 호스트가 별도 예약한다. AbortSignal은 SDK에 전달하나 공급자에서 이미 시작된 계산·청구를 회수한다고 보장하지 않는다. host onMetadata 콜백에는 원문이 없다.

## 실제 반영 전 반드시 할 통합 검사

두 인증 세션/다른 가구, 수신자 변경, membership 탈퇴, generation 중 철회, 버전 경쟁, old acceptance, queue 실패/중복, 알림 취소, 실제 DB 저장·조회·삭제·백업 복구를 시험한다. ChangePlanDraft는 항상 executable=false이며 쓰기 도구가 없다. execute라는 함수나 전체 앱 REST 경로는 제공하지 않는다. 독립 승인 합의의 철회와 원문 삭제를 자동으로 동일시하지 않는다.

## Claim 화자와 실패 사용량

개인 단계의 `Claim.speakerId`는 `scope.actorId`, 즉 현재 보고한 사용자입니다. 타인의 인용문은 그 사용자가 전한 말이며 상대가 직접 승인한 진술로 바뀌지 않습니다. 상대 발언 보고는 `interpretation`으로 표시하고 공동 맥락은 별도의 승인 카드만 받습니다.

`RelationshipError.providerUsage`는 공급자가 실제로 반환한 모델 식별자와 토큰 수만 포함합니다. 잘림·거절·JSON 오류라도 usage가 있으면 계측하며, 없는 응답/네트워크 실패는 null로 남깁니다. 실제 청구 금액은 단가 기반 추정치와 다릅니다.
