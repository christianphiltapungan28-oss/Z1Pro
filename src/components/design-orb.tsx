import type { CSSProperties, ReactNode } from "react";

/*
 * The orb from the Figma design (component 42:135), rebuilt from its own
 * layers in /public/ui/orb. Its look depends on blend modes (overlay,
 * colour-dodge, screen…) mixing with the white page behind it, so it can't
 * be a single flattened image. Every position, mask offset and blend mode
 * below is copied from the design; each instance scales the whole stack.
 */
// The layer stack is built at the component's own size, because the mask
// offsets Figma exports are in component units, then scaled to fit.
const BASE_WIDTH = 903;
const BASE_HEIGHT = 1056.75;

const MASK_URL = "url(/ui/orb/mask.svg)";

function mask(x: number, y: number): CSSProperties {
  return {
    maskImage: MASK_URL,
    WebkitMaskImage: MASK_URL,
    maskMode: "alpha",
    maskComposite: "intersect",
    WebkitMaskComposite: "source-in",
    maskClip: "no-clip",
    WebkitMaskClip: "no-clip",
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskPosition: `${x}px ${y}px`,
    WebkitMaskPosition: `${x}px ${y}px`,
    maskSize: "798px 809.688px",
    WebkitMaskSize: "798px 809.688px",
  };
}

function Layer({ file }: { file: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt="" src={`/ui/orb/${file}`} className="block size-full max-w-none" />;
}

function AbsLayer({ file, blur }: { file: string; blur?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt=""
      src={`/ui/orb/${file}`}
      className="absolute inset-0 block size-full max-w-none"
      style={blur ? { filter: `blur(${blur}px)` } : undefined}
    />
  );
}

// Figma's export drops layer blur, so these radii (at component scale)
// were tuned by eye against Figma's own render of the orb.
const BLUR = { dots: 40, pink: 90, orange: 50, whiteCore: 75 };

/** A layer rotated/flipped inside a size container, as Figma exports them. */
function Transformed({
  inset,
  blend,
  transform,
  size = { width: "100cqw", height: "100cqh" },
  children,
}: {
  inset: string;
  blend?: CSSProperties["mixBlendMode"];
  transform: string;
  size?: { width: string; height: string };
  children: ReactNode;
}) {
  return (
    <div
      className="absolute flex items-center justify-center"
      style={{ inset, mixBlendMode: blend, containerType: "size" }}
    >
      <div className="flex-none" style={{ transform, ...size }}>
        {children}
      </div>
    </div>
  );
}

// Layers inside "Group 10" are rotated -9° and sized to their bounding box.
const ROTATED_9 = {
  width: "hypot(86.3271cqw, -13.6729cqh)",
  height: "hypot(13.6729cqw, 86.3271cqh)",
};

export function DesignOrb({ width }: { width: number }) {
  const scale = width / BASE_WIDTH;
  return (
    <div
      aria-hidden="true"
      className="relative shrink-0"
      style={{ width, height: BASE_HEIGHT * scale }}
    >
      <div
        className="absolute top-0 left-0 bg-white"
        style={{
          width: BASE_WIDTH,
          height: BASE_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <div className="absolute" style={{ inset: "0 0 14.55% 0" }}>
          <div className="absolute" style={{ inset: "-25.47%" }}>
            <Layer file="ellipse-2.png" />
          </div>
        </div>

        <Transformed inset="7.38% 13.95% 62.81% 13.95%" blend="overlay" transform="scaleX(-1)">
          <div className="relative size-full" style={mask(-73, -3)}>
            <div className="absolute" style={{ inset: "-34.6% -16.74%" }}>
              <Layer file="ellipse-11.png" />
            </div>
          </div>
        </Transformed>

        <div
          className="absolute"
          style={{ inset: "9.84% 20.27% 46.38% 20.38%", mixBlendMode: "color-dodge", ...mask(-131, -29) }}
        >
          <AbsLayer file="group-6.svg" blur={BLUR.dots} />
        </div>
        <Transformed inset="9.84% 20.27% 46.38% 20.38%" blend="hard-light" transform="scaleX(-1)">
          <div className="relative size-full" style={mask(-131, -29)}>
            <AbsLayer file="group-7.svg" blur={BLUR.dots} />
          </div>
        </Transformed>

        <Transformed inset="62.17% 20.49% 13.41% 20.49%" blend="overlay" transform="rotate(180deg) scaleX(-1)">
          <div className="relative size-full" style={mask(-132, -582)}>
            <div className="absolute" style={{ inset: "-53.88% -26.08%" }}>
              <Layer file="ellipse-12.png" />
            </div>
          </div>
        </Transformed>

        <div
          className="absolute"
          style={{ inset: "5.49% 21.37% 72.27% 21.48%", mixBlendMode: "saturation", ...mask(-141, 17) }}
        >
          <div className="absolute" style={{ inset: "-14.89% -6.78%" }}>
            <Layer file="ellipse-9.svg" />
          </div>
        </div>

        <div className="absolute" style={{ inset: "8.71% 37.76% 83.82% 37.76%", ...mask(-288, -17) }}>
          <div className="absolute" style={{ inset: "-73.42% -26.24%" }}>
            <Layer file="ellipse-4.svg" />
          </div>
        </div>

        <Transformed inset="26.51% 10.59% 23.48% 30.88%" blend="screen" transform="rotate(-9deg)" size={ROTATED_9}>
          <div className="relative size-full" style={mask(-225.891, -205.133)}>
            <AbsLayer file="ellipse-116.svg" blur={BLUR.orange} />
          </div>
        </Transformed>
        <Transformed inset="11.59% 30% 38.4% 11.47%" blend="screen" transform="rotate(-9deg)" size={ROTATED_9}>
          <div className="relative size-full" style={mask(-50.606, -47.502)}>
            <AbsLayer file="ellipse-114.svg" blur={BLUR.pink} />
          </div>
        </Transformed>
        <Transformed inset="29.42% 26.7% 37.9% 35.05%" blend="overlay" transform="rotate(-9deg)" size={ROTATED_9}>
          <div className="relative size-full" style={mask(-263.542, -235.893)}>
            <AbsLayer file="ellipse-115.svg" blur={BLUR.whiteCore} />
          </div>
        </Transformed>

        <div className="absolute" style={{ inset: "7.1% 5.65% 17.2% 5.76%", ...mask(1, 0) }}>
          <div className="absolute" style={{ inset: "-6.62%" }}>
            <Layer file="ellipse-110.svg" />
          </div>
        </div>
        <div className="absolute" style={{ inset: "7.1% 6.2% 18.15% 6.31%", ...mask(-4, 0) }}>
          <div className="absolute" style={{ inset: "-5.44%" }}>
            <Layer file="ellipse-109.svg" />
          </div>
        </div>
        <div
          className="absolute"
          style={{ inset: "6.72% 5.87% 17.96% 5.98%", mixBlendMode: "overlay", ...mask(-1, 4) }}
        >
          <div className="absolute" style={{ inset: "-2.51%" }}>
            <Layer file="ellipse-111.svg" />
          </div>
        </div>
      </div>
    </div>
  );
}
