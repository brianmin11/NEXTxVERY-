# 픽셀 자산 출처

- 출처: Figma Make로 생성한 프로토타입 `우리집 가족 앱 프로토타입`의 `public/assets/pixel/` (2026-11-01 내려받음).
- 내용: 테마 배경 5종(`themes/<id>/01_sky.svg … 05_front.svg`, `background.svg`), 캐릭터 레이어(`characters/{body,face,hair,outfit,accessory}`). 모두 `<rect>`만으로 그린 SVG이고 외부 참조·래스터 임베드가 없다.
- 좌표계: 테마 `viewBox 0 0 130 140`(13:14), 캐릭터 `viewBox 0 0 20 28`(5:7). `shape-rendering="crispEdges"`로 그려져 있어 `image-rendering: pixelated`로 표시한다.
- 카탈로그(`lib/character/catalog.ts`, `lib/scene/themes.ts`)에는 **서로 다른 파일이 실제로 있는 항목만** 등록한다. 원본 코드의 중복 매핑(`flower→acc_ribbon`, `scarf/beret→acc_beanie`, `lake/brick/alpine→다른 테마`)은 가져오지 않았다.
- 이 메모는 파일의 출처를 기록할 뿐이며, 독점 사용권이나 라이선스 확인을 보증하지 않는다. 배포 전 Figma Make 생성물의 이용 조건을 확인한다.
- 참고 이미지 폴더(`레퍼런스/`)의 캐릭터·로고는 복사하지 않았다.
