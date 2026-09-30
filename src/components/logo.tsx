// The Z1P logo (Figma 423:2704), exported with its lettering as shapes and
// cropped to the artwork: /public/ui/logo.svg, 112 × 33.5.
const LOGO_RATIO = 112 / 33.5;

/**
 * The logo at `height` pixels. Drawn as a mask so it takes the current text
 * colour: the design's pink by default, white on the pink brand panels.
 */
export function Logo({ height, className = "text-logo" }: { height: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label="Z1P"
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{
        width: height * LOGO_RATIO,
        height,
        maskImage: "url(/ui/logo.svg)",
        WebkitMaskImage: "url(/ui/logo.svg)",
        maskSize: "100% 100%",
        WebkitMaskSize: "100% 100%",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
      }}
    />
  );
}
