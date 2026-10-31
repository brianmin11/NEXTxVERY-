import { CHARACTER_BOX, characterLayers, describeCharacter, type CharacterConfig } from "@/lib/character/catalog"
import { cn } from "@/lib/utils"

type PixelCharacterProps = {
  config: CharacterConfig
  /** 접근성 이름에 쓰는 구성원 이름 */
  name: string
  /** 픽셀 높이. 폭은 20:28 비율로 계산한다. */
  size?: number
  /** 장식용이면 true. 기본은 이름을 읽어 준다. */
  decorative?: boolean
  className?: string
}

/**
 * 레이어 SVG 5장(의상→몸→얼굴→머리→소품)을 겹쳐 그리는 픽셀 캐릭터.
 * 정적 SVG라 next/image 최적화가 의미 없고, 레이어 수가 많아 `<img>`를 그대로 쓴다(MemoryImage와 같은 이유).
 * 크기는 부모가 정하고 `image-rendering: pixelated`로 또렷하게 확대한다.
 */
export function PixelCharacter({ config, name, size = 56, decorative = false, className }: PixelCharacterProps) {
  const width = Math.round((size * CHARACTER_BOX.width) / CHARACTER_BOX.height)
  return (
    <span
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : `${name} 캐릭터: ${describeCharacter(config)}`}
      aria-hidden={decorative || undefined}
      className={cn("relative inline-block shrink-0 select-none", className)}
      style={{ width, height: size }}
    >
      {characterLayers(config).map((layer) => (
        // eslint-disable-next-line @next/next/no-img-element -- 정적 픽셀 SVG 레이어. 최적화 대상이 아니다.
        <img
          key={layer.key}
          src={layer.src}
          alt=""
          draggable={false}
          width={width}
          height={size}
          className="pixelated pointer-events-none absolute inset-0 block h-full w-full"
        />
      ))}
    </span>
  )
}
