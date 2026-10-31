import {
  FlowersLayer,
  GardenLayer,
  GarlandLayer,
  GroundLayer,
  HOUSE_TRANSFORM,
  HouseLayer,
  HouseShadowLayer,
  MailboxLayer,
  PlanterLayer,
  SCENE_BOX,
  SkyLayer,
  type HouseStage,
} from "./house-layers"

/**
 * 2.5D SVG 집 성장 단계 시안(개발용 미리보기 전용). 사용자 홈은 픽셀 테마 장면(PixelScene)을 쓴다.
 * 성장 정책은 미정이며 테마와 합치지 않는다.
 */
export function HouseStagePreview({ stage, className }: { stage: HouseStage; className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${SCENE_BOX.width} ${SCENE_BOX.height}`}
      preserveAspectRatio="xMidYMax meet"
      className={className}
      role="img"
      aria-label={`집 ${stage}단계 시안`}
    >
      <SkyLayer rainbow={stage >= 5} />
      <GroundLayer />
      <g transform={HOUSE_TRANSFORM}>
        <HouseShadowLayer />
        {stage >= 4 && <GardenLayer />}
        <HouseLayer />
        <MailboxLayer />
        {stage >= 2 && <PlanterLayer />}
        {stage >= 3 && <FlowersLayer />}
        {stage >= 5 && <GarlandLayer />}
      </g>
    </svg>
  )
}
