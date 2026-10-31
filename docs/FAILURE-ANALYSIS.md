# 실패 원인과 수정 근거

2026-11-01 KST. 이 문서는 확인된 직접 원인과 내부 원인 가설을 구분한다.

## 1. 인증 실패: 서버의 권한 판정 거절

초기 키에는 Models Read만 있었고 Responses Write가 없었다. 첫 HTTP401은 `api.responses.write` 부족으로 설명된다. 사용자가 승인한 뒤 플랫폼에서 Write를 저장하고 다시 열어 저장 상태를 확인했다. 이후에도 성공 응답 사이에 동일 HTTP401이 반복됐다.

로컬 점검에서 process 환경의 별도 OPENAI_API_KEY, OPENAI_BASE_URL, 조직/프로젝트 override, HTTP(S)/ALL proxy, NODE_OPTIONS는 없었다. `.env.local`의 키가 편집한 키와 일치함을 값 출력 없이 확인했다. 테스트 어댑터로 전환하거나 SDK 자동 재시도를 하는 경로도 없었다.

기존 기록에는 요청 ID가 없어 저장 후 간헐 거절의 서버 내부 원인을 확정할 수 없다. **인증 캐시 전파 지연은 가능한 설명이며 확정 원인으로 보고하지 않는다.** [공식 키 수정 문서](https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/projects/subresources/api_keys/methods/update)는 dashboard/API scope 수정 모두 인증 캐시 전파를 따른다고 명시한다.

진단용 fetch 관찰기를 추가했다. 기본 공식 API 주소, 실제 전송 credential의 로컬 값 일치 여부(boolean), 조직·프로젝트 header 존재 여부, payload SHA256, HTTP status, x-request-id, 허용 형식 scope명만 기록한다. 키·Authorization·원문 error message·전체 header는 저장하지 않는다. 식별자 필드로 반사된 credential 형식/동일 키도 제거한다. 관찰기를 제거해도 요청/응답 의미는 바뀌지 않으며 observer 실패가 모델 결과를 바꾸지 않게 한다.

2026-10-31 14:57 UTC 진단 요청은 동일 키로 `/v1/responses` HTTP200을 받았고, K10의 REFLECTION_ONLY 결과가 계약 검증을 통과했다. 이후의 개발/holdout 상태와 전체 건수는 LIVE-EVALUATION.md를 기준으로 한다. 공급자 키를 새로 만들거나 All 권한으로 확대해서 우회하지 않았다.

## 2. 의미 검증 실패: 화자 계약과 프롬프트의 불일치

개인 입력은 현재 사용자의 보고다. 상대의 발언을 인용했더라도 상대가 직접 제출/승인한 진술이 아니다. 기존 프롬프트는 이 speakerId 의미를 명확히 하지 않아 모델이 상대 ID를 넣었고, 엔진의 동일 화자 검증에서 SEMANTIC_INVALID로 거절됐다.

ko-relationship-2에서 speakerId를 보고자인 scope.actorId로 명시하고 상대 인용은 보고/해석으로 표현하도록 했다. 검증기를 느슨하게 하거나 모델 값을 강제로 덮어쓰지 않았다.

## 3. 평가 설계 실패: 한 가지 진입점에 모든 기능을 의존

기존 runner는 모든 사례를 개인 대화 1턴, 빈 기억/일정, 고정된 부모 actor로 시작했다. clarification_required이면 바로 종료했다. 공동 단계용 승인 카드도 이 종료 이후에야 구성됐다. 따라서 정상적인 질문 응답이 많을수록 공동 분석/합의/수정 기능이 검증되지 않았다. K13의 역할 반전 설명도 실제 대조 입력이 아니었다.

평가 계약을 personal/flow/joint 진입점으로 분리했다. fixture에 actor, route, 사전 답변(최대1턴), 승인 카드, 일정, 기억 상태, 변형 입력, 필수 단계와 기대 종료를 명시했다. joint는 승인된 별도 입력으로 직접 검사하고, flow만 개인→공유→명시적 합성 호스트 승인→공동 분석→합의→변경안을 검사한다. revise는 실제 모델을 호출하고 defer/decline는 결정적 로직으로 검사한다.

ko-relationship-3은 ready를 '현재 개인 표현 정리에 충분'으로 정의한다. 후속 합의의 미정 필드는 unknown으로 남긴다. 현재 요청을 처리할 필수 정보가 부족하면 clarification_required를 유지한다. 평가기가 ready로 강제 변경하지 않는다.

이는 입력 fixture와 일반적인 계약의 수정이다. 제품 코드 또는 평가 dispatcher에 K01 등 사례 ID, 특정 이름/요일/문장별 응답 분기를 넣지 않는다. 고정된 합성 입력은 테스트의 재현성을 위한 것이며 모델의 정답 응답을 미리 넣는 방식과 구별한다.

## 4. 시각 누락을 자정으로 보충한 제안

ko-relationship-3의 개발 실행에서 K22는 날짜 범위만 있는 역할 요청에 start를 자정으로 채웠다. 호스트 기준 now는 그날 오전이어서 compileChangePlan이 START_IN_PAST로 차단했다. 이 초안을 실행 성공으로 취급하지 않았다.

ko-relationship-4는 날짜만 있고 시각이 없으면 instant 필드를 null로 남기고 날짜 범위는 설명/unknown에 보존하도록 명시한다. 새 제안 시각도 now 이전으로 설정하지 않도록 했다. 특정 K22 문장이나 날짜를 분기하지 않는 공통 스키마 해석 규칙이다. 수정안도 다시 compile하여 원본/수정본의 blockers와 operationalIssues를 함께 기록한다.

## 완료 의미

사례 terminal 처리, 필수 단계 coverage, 스키마·출처·권한·버전·시간 검사, 한국어 사람 품질 평가는 각각 다르다. 정상 질문/개인 지원/철회 거절도 기대된 결과일 수 있다. EXPECTED_ERROR는 실제 공급자 성공이 아니다. 모델 judge나 합성 테스트 성공만으로 사람 평가·가족 관계 효과·실제 앱 통합을 통과 처리하지 않는다.
