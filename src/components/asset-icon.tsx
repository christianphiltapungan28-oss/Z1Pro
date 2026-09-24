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
