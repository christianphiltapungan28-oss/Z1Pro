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
 * Masks `children` to the sphere, with the mask placed against the parent's
 * box. Browsers clip a masked element to its own box (Safari always, since
 * it lacks `mask-clip: no-clip`; Chrome once something inside animates),
 * cutting blur and oversized images off in hard straight lines. So the
 * masked box is padded out by SPILL and the mask offset by the padding.
 */
function Masked({ maskAt: [x, y], children }: { maskAt: [number, number]; children: ReactNode }) {
  return (
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
        {children}
      </div>
    </div>
  );
}

/**
 * A layer's box at `inset` (as Figma's top/right/bottom/left percentages).
 * Safari clips a blend-mode element to its own box, so the blending box is
 * grown by SPILL on every side and the content placed back at `inset`.
 */
function Box({
  inset,
  blend,
  className = "",
  children,
}: {
  inset: string;
  blend?: CSSProperties["mixBlendMode"];
  className?: string;
  children: ReactNode;
}) {
  const [top, right, bottom, left] = inset.split(" ").map((v) => `calc(${v} - ${SPILL}px)`);
  return (
    <div className="absolute" style={{ top, right, bottom, left, mixBlendMode: blend }}>
      <div className={`absolute ${className}`} style={{ inset: SPILL }}>
        {children}
      </div>
    </div>
  );
}

/** A colour layer masked to the sphere, turning inside its still mask. */
function SpinningMasked({
  maskAt,
  spin: { seconds, reverse },
  children,
}: {
  maskAt: [number, number];
  spin: Spin;
  children: ReactNode;
}) {
  const degreesPerSecond = (reverse ? -360 : 360) / seconds;
  const [x, y] = maskAt;
  return (
    <div className="relative size-full">
      <Masked maskAt={maskAt}>
        <div
          className="absolute inset-0"
          style={{
            transform: `rotate(calc(var(--orb-turn, 0) * ${degreesPerSecond}deg))`,
            transformOrigin: `${x + MASK_CENTER.x}px ${y + MASK_CENTER.y}px`,
          }}
        >
          {children}
        </div>
      </Masked>
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

/**
 * A layer rotated/flipped inside its box, as Figma exports them. Layers
 * inside "Group 10" (`rotated9`) are rotated -9° and sized so their
 * bounding box fills it. Sizes are worked out here rather than with
 * container units: a size container clips its blur in Safari.
 */
function Transformed({
  inset,
  blend,
  transform,
  rotated9 = false,
  children,
}: {
  inset: string;
  blend?: CSSProperties["mixBlendMode"];
  transform: string;
  rotated9?: boolean;
  children: ReactNode;
}) {
  const [top, right, bottom, left] = inset.split(" ").map((v) => parseFloat(v) / 100);
  const w = BASE_WIDTH * (1 - left - right);
  const h = BASE_HEIGHT * (1 - top - bottom);
  const size = rotated9
    ? { width: Math.hypot(0.863271 * w, 0.136729 * h), height: Math.hypot(0.136729 * w, 0.863271 * h) }
    : { width: w, height: h };
  return (
    <Box inset={inset} blend={blend} className="flex items-center justify-center">
      <div className="flex-none" style={{ transform, ...size }}>
        {children}
      </div>
    </Box>
  );
}

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

        <Box inset="9.84% 20.27% 46.38% 20.38%" blend="color-dodge">
          <SpinningMasked maskAt={[-131, -29]} spin={SPIN.dots}>
            <AbsLayer file="group-6.svg" blur={BLUR.dots} />
          </SpinningMasked>
        </Box>
        <Transformed inset="9.84% 20.27% 46.38% 20.38%" blend="hard-light" transform="scaleX(-1)">
          <SpinningMasked maskAt={[-131, -29]} spin={SPIN.dots}>
            <AbsLayer file="group-7.svg" blur={BLUR.dots} />
          </SpinningMasked>
        </Transformed>

        <Box inset="5.49% 21.37% 72.27% 21.48%" blend="saturation">
          <Masked maskAt={[-141, 17]}>
            <div className="absolute" style={{ inset: "-14.89% -6.78%" }}>
              <Layer file="ellipse-9.svg" />
            </div>
          </Masked>
        </Box>

        <div className="absolute" style={{ inset: "8.71% 37.76% 83.82% 37.76%" }}>
          <Masked maskAt={[-288, -17]}>
            <div className="absolute" style={{ inset: "-73.42% -26.24%" }}>
              <Layer file="ellipse-4.svg" />
            </div>
          </Masked>
        </div>

        <Transformed inset="26.51% 10.59% 23.48% 30.88%" blend="screen" transform="rotate(-9deg)" rotated9>
          <SpinningMasked maskAt={[-225.891, -205.133]} spin={SPIN.orange}>
            <AbsLayer file="ellipse-116.svg" blur={BLUR.orange} />
          </SpinningMasked>
        </Transformed>
        <Transformed inset="11.59% 30% 38.4% 11.47%" blend="screen" transform="rotate(-9deg)" rotated9>
          <SpinningMasked maskAt={[-50.606, -47.502]} spin={SPIN.pink}>
            <AbsLayer file="ellipse-114.svg" blur={BLUR.pink} />
          </SpinningMasked>
        </Transformed>
        <Transformed inset="29.42% 26.7% 37.9% 35.05%" blend="overlay" transform="rotate(-9deg)" rotated9>
          <SpinningMasked maskAt={[-263.542, -235.893]} spin={SPIN.whiteCore}>
            <AbsLayer file="ellipse-115.svg" blur={BLUR.whiteCore} />
          </SpinningMasked>
        </Transformed>

        <div className="absolute" style={{ inset: "7.1% 5.65% 17.2% 5.76%" }}>
          <Masked maskAt={[1, 0]}>
            <div className="absolute" style={{ inset: "-6.62%" }}>
              <Layer file="ellipse-110.svg" />
            </div>
          </Masked>
        </div>
        <div className="absolute" style={{ inset: "7.1% 6.2% 18.15% 6.31%" }}>
          <Masked maskAt={[-4, 0]}>
            <div className="absolute" style={{ inset: "-5.44%" }}>
              <Layer file="ellipse-109.svg" />
            </div>
          </Masked>
        </div>
        <Box inset="6.72% 5.87% 17.96% 5.98%" blend="overlay">
          <Masked maskAt={[-1, 4]}>
            <div className="absolute" style={{ inset: "-2.51%" }}>
              <Layer file="ellipse-111.svg" />
            </div>
          </Masked>
        </Box>
      </div>
    </div>
  );
}
