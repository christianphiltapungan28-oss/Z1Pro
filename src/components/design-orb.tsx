"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";
import { useOrbMotion, type LevelSource } from "@/lib/use-orb-motion";

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

// Centre of the mask's circle, inside its 798 × 809.688 box.
const MASK_CENTER = { x: 399, y: 395 };

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

/*
 * The colours turn inside the still glass shell, like the component's four
 * variants: slowly all the time, faster while Z1p is thinking or speaking
 * (see useOrbMotion). Each layer turns around the centre of its own (still)
 * mask, with its own speed and direction, so the colours swirl rather than
 * rotate as one and never leave the sphere. `seconds` is one full turn at
 * base speed.
 */
type Spin = { seconds: number; reverse?: boolean };

const SPIN = {
  topGlow: { seconds: 9 },
  dots: { seconds: 12, reverse: true },
  orange: { seconds: 7, reverse: true },
  pink: { seconds: 6 },
  whiteCore: { seconds: 10 },
} satisfies Record<string, Spin>;

// How far a layer's blur and oversized images spill past its box.
const SPILL = 400;

/**
 * A colour layer masked to the sphere, turning inside its still mask.
 * Once something inside a mask animates, Chrome clips the mask to the
 * element's box, cutting off everything that spills past it, so the masked
 * box is padded out by SPILL and the mask placed against the original box.
 */
function SpinningMasked({
  maskAt: [x, y],
  spin: { seconds, reverse },
  children,
}: {
  maskAt: [number, number];
  spin: Spin;
  children: ReactNode;
}) {
  const degreesPerSecond = (reverse ? -360 : 360) / seconds;
  return (
    <div className="relative size-full">
      <div
        className="absolute"
        style={{
          inset: -SPILL,
          padding: SPILL,
          ...mask(x, y),
          maskOrigin: "content-box",
          WebkitMaskOrigin: "content-box",
        }}
      >
        <div className="absolute" style={{ inset: SPILL }}>
          <div
            className="absolute inset-0"
            style={{
              transform: `rotate(calc(var(--orb-turn, 0) * ${degreesPerSecond}deg))`,
              transformOrigin: `${x + MASK_CENTER.x}px ${y + MASK_CENTER.y}px`,
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
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

/**
 * `active` is while Z1p is thinking or speaking; `getLevel` gives the voice's
 * loudness while it speaks, so the orb pulses with it.
 */
export function DesignOrb({
  width,
  active = false,
  getLevel,
}: {
  width: number;
  active?: boolean;
  getLevel?: LevelSource;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useOrbMotion(ref, active, getLevel);
  const scale = width / BASE_WIDTH;
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="relative shrink-0"
      style={{
        width,
        height: BASE_HEIGHT * scale,
        transform: "scale(calc(1 + var(--orb-level, 0) * 0.07))",
      }}
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
          <SpinningMasked maskAt={[-73, -3]} spin={SPIN.topGlow}>
            <div className="absolute" style={{ inset: "-34.6% -16.74%" }}>
              <Layer file="ellipse-11.png" />
            </div>
          </SpinningMasked>
        </Transformed>

        <div className="absolute" style={{ inset: "9.84% 20.27% 46.38% 20.38%", mixBlendMode: "color-dodge" }}>
          <SpinningMasked maskAt={[-131, -29]} spin={SPIN.dots}>
            <AbsLayer file="group-6.svg" blur={BLUR.dots} />
          </SpinningMasked>
        </div>
        <Transformed inset="9.84% 20.27% 46.38% 20.38%" blend="hard-light" transform="scaleX(-1)">
          <SpinningMasked maskAt={[-131, -29]} spin={SPIN.dots}>
            <AbsLayer file="group-7.svg" blur={BLUR.dots} />
          </SpinningMasked>
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
          <SpinningMasked maskAt={[-225.891, -205.133]} spin={SPIN.orange}>
            <AbsLayer file="ellipse-116.svg" blur={BLUR.orange} />
          </SpinningMasked>
        </Transformed>
        <Transformed inset="11.59% 30% 38.4% 11.47%" blend="screen" transform="rotate(-9deg)" size={ROTATED_9}>
          <SpinningMasked maskAt={[-50.606, -47.502]} spin={SPIN.pink}>
            <AbsLayer file="ellipse-114.svg" blur={BLUR.pink} />
          </SpinningMasked>
        </Transformed>
        <Transformed inset="29.42% 26.7% 37.9% 35.05%" blend="overlay" transform="rotate(-9deg)" size={ROTATED_9}>
          <SpinningMasked maskAt={[-263.542, -235.893]} spin={SPIN.whiteCore}>
            <AbsLayer file="ellipse-115.svg" blur={BLUR.whiteCore} />
          </SpinningMasked>
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
