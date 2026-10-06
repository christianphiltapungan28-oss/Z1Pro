/*
 * The app's icon set (Figma "Icons Component" 134:1532), in /public/ui/icons.
 * Each entry is the exported SVG's size and the size of the box it sits in
 * in Figma, so an icon keeps its proportions and its padding at any size.
 */
const ICON_SET = {
  home: { w: 22.2129, h: 18.2568, box: 22.2129 },
  stacks: { w: 20.9463, h: 20.3204, box: 20.9463 },
  "chat-spark": { w: 21.334, h: 21.334, box: 24 },
  book: { w: 22, h: 19.4717, box: 24 },
  asterisk: { w: 24, h: 24, box: 24 },
  settings: { w: 24, h: 24, box: 24 },
  logout: { w: 18, h: 17.25, box: 18 },
  "calendar-clock": { w: 26.6667, h: 26.6667, box: 32 },
  flight: { w: 20, h: 20.7812, box: 24 },
  "developer-board": { w: 20, h: 18, box: 24 },
  "control-camera": { w: 20.8282, h: 20.8282, box: 24 },
  "electrical-services": { w: 19, h: 19, box: 24 },
  "generate-text": { w: 23, h: 23, box: 24 },
} as const;

export type IconSetName = keyof typeof ICON_SET;

/** An icon from the set, drawn for a `size`-pixel box as in the design. */
export function IconSetIcon({
  name,
  size,
  className,
}: {
  name: IconSetName;
  size: number;
  className?: string;
}) {
  const { w, h, box } = ICON_SET[name];
  const scale = size / box;
  return (
    <AssetIcon name={`icons/${name}`} width={w * scale} height={h * scale} className={className} />
  );
}

/**
 * Renders one of the Figma-exported icon SVGs in /public/ui as a mask, so it
 * keeps the design's exact shape but takes the surrounding text colour —
 * the exports are drawn in solid black, which would vanish in dark themes.
 * Width and height are the SVG's own root dimensions.
 */
export function AssetIcon({
  name,
  width,
  height,
  className = "",
}: {
  name: string;
  width: number;
  height: number;
  className?: string;
}) {
  const url = `url(/ui/${name}.svg)`;
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{
        width,
        height,
        maskImage: url,
        WebkitMaskImage: url,
        maskSize: "100% 100%",
        WebkitMaskSize: "100% 100%",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
      }}
    />
  );
}
