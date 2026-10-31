# 확인한 조건과 한계

2026-10-31 공식 문서 재확인: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [GPT-6.1 Sol 가격·지원](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [Under-18](https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance). SDK helper zodTextFormat과 responses.create는 설치된 openai 소스에서도 확인했다.

OpenAI 어댑터 구현은 공급자 계약 확정이나 청소년 서비스 적합성 승인이 아니다. 미성년 서비스에는 추가 보호·고지·운영 대응이 필요하고, 13세 미만 또는 해당 디지털 동의 연령 미만 아동 개인정보 처리 시 ZDR 조건을 검토해야 한다. 한국의 만14세 기준, 민법상 만19세와 API under18을 혼동하지 않는다. store:false만으로 ZDR이 성립하지 않는다. 평가에는 합성 성인 역할극만 사용한다.

사용자 승인 후 모델 계정 접근과 실제 구조화 출력을 확인했다. 호출·자동 검사 결과는 LIVE-EVALUATION.md에, 한국어 사람 품질 평가는 별도 미검증 상태로 기록한다. SDK와 JSON schema의 로컬 호환 검사만으로 live 성공을 주장하지 않는다. 최신 모델·정책·요금은 운영 연결 직전 다시 확인한다. 이 단계에서는 OpenAI 실험 연결만 구현했고 최종 제공자/모델 채택은 미정이다.

고정 스키마만으로 일반 자연어의 진실성·상대 의도·위험을 증명할 수 없다. evidence 존재와 문자 일치는 결정적으로 검사하나 원문의 해석 타당성·간접 누출·악의적 암시까지 완전 검출하지 못한다. 위험 분류는 같은 모델의 private 결과에 의존하므로 별도 사람 지원·신고·연령별 운영 정책을 호스트가 마련해야 한다. 안전 제한 사유나 신고자 정보를 공동 상태·배지에 노출하면 안 된다.

시간은 호스트 now/timezone과 offset ISO로만 처리한다. 모호한 한국어 날짜는 null/제안으로 남긴다. DST·반복 일정 전체 확장·외부 캘린더의 예외 규칙은 제한적이므로 실제 실행 전 호스트 캘린더 엔진에서 충돌을 재검사한다. 무한 반복/지원하지 않는 반복은 허용하지 않는다.

이 패키지에는 최신 합의 저장소가 없다. prior 최신성, 승인 버전·semantic hash·수신자·purpose·membership, 실행 직전 철회를 호스트가 다시 검증해야 한다. SharedPrior의 내용 해시·공유 범위·출처 버전을 검사하지만 envelope를 브라우저가 임의로 만들게 두면 인증된 provenance를 보장할 수 없다. 서버 저장 metadata를 사용한다. 참조형 metadata만으로 실제 원문/DB/백업 삭제 완료가 증명되지 않는다.

SDK 오류 메시지는 외부로 내보내지 않는다. 모델 호출 실패의 실제 청구량은 알 수 없을 수 있다. 비용 상한은 공개 가격과 바이트 기반 보수 추정이며 제공자 계약·청구 오류까지 제한하는 결제 장치가 아니다. 앱의 월별/동시 사용량 예약과 공급자 계정 지출 한도는 별도다.

브라우저 화면·인증·RLS·저장·공유 승인·일정 실행·배포는 이번 구현 범위 밖이고 미검증이다. 성능 테스트나 임상 중재, 관계 개선, 지불 의사에 관한 결과를 주장하지 않는다.
