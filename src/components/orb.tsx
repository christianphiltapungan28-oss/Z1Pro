import type { Appearance } from "@/lib/use-appearance";

function GlossyOrb({ size }: { size: number }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="absolute inset-[-30%] rounded-full opacity-70 blur-2xl"
        style={{
          background:
            "conic-gradient(from 90deg, #ff8fb1, #7b6bff, #5ad1ff, #ff8fb1)",
          animation: "orb-spin 9s linear infinite",
        }}
      />
      <div
        className="absolute inset-0 rounded-full"
        style={{
          animation: "orb-pulse 4s ease-in-out infinite",
          background:
            "radial-gradient(circle at 35% 30%, #eaf6ff 0%, #8fd3ff 18%, #5a7bff 42%, #3a2fb0 68%, #150c33 100%)",
          boxShadow:
            "0 0 40px rgba(122,107,255,0.55), inset 0 0 30px rgba(0,0,0,0.35)",
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center gap-[18%]">
          {[0, 1].map((i) => (
            <span
              key={i}
              className="block rounded-full"
              style={{
                width: "16%",
                height: "16%",
                background:
                  "radial-gradient(circle at 35% 35%, #ffffff, #bfe9ff 60%, transparent 100%)",
                boxShadow: "0 0 12px 4px rgba(255,255,255,0.8)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SoftOrb({ size }: { size: number }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="absolute inset-[-25%] rounded-full opacity-70 blur-2xl"
        style={{
          background:
            "conic-gradient(from 45deg, #ff1da5, #7b6bff, #ffb15e, #ff1da5)",
          animation: "orb-drift 6s ease-in-out infinite",
        }}
      />
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 38% 30%, #ffb15e 0%, #ff1da5 42%, #c81fb0 68%, #5a3fd6 100%)",
          boxShadow:
            "0 8px 30px rgba(255,29,165,0.35), inset 0 0 24px rgba(255,255,255,0.35)",
        }}
      />
    </div>
  );
}

function MeshOrb({ size }: { size: number }) {
  const rings = [0, 1, 2, 3, 4];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="absolute inset-[-35%] rounded-full opacity-80 blur-2xl"
        style={{
          background:
            "conic-gradient(from 120deg, #ff2f7e, #3a49ff, #38e0d8, #ff2f7e)",
          animation: "orb-spin 8s linear infinite",
        }}
      />
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 40% 35%, rgba(120,220,255,0.35), rgba(10,6,22,0.9) 70%)",
          boxShadow: "0 0 45px rgba(58,73,255,0.5)",
        }}
      />
      <div
        className="absolute inset-0 rounded-full"
        style={{
          animation: "orb-spin 14s linear infinite",
          maskImage: "radial-gradient(circle, black 96%, transparent 100%)",
        }}
      >
        {rings.map((i) => (
          <span
            key={i}
            className="absolute inset-0 rounded-full border"
            style={{
              borderColor: i % 2 === 0 ? "#7fe7e0" : "#b98bff",
              opacity: 0.35,
              transform: `rotate(${i * 36}deg) scaleY(${0.3 + i * 0.15})`,
            }}
          />
        ))}
      </div>
      <div
        className="absolute inset-0 rounded-full"
        style={{
          animation: "orb-spin-reverse 20s linear infinite",
          maskImage: "radial-gradient(circle, black 96%, transparent 100%)",
        }}
      >
        {rings.map((i) => (
          <span
            key={`v-${i}`}
            className="absolute inset-0 rounded-full border"
            style={{
              borderColor: i % 2 === 0 ? "#b98bff" : "#7fe7e0",
              opacity: 0.3,
              transform: `rotate(${90 + i * 36}deg) scaleY(${0.3 + i * 0.15})`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function Orb({
  size = 168,
  appearance = "light",
}: {
  size?: number;
  appearance?: Appearance;
}) {
  if (appearance === "light") return <SoftOrb size={size} />;
  if (appearance === "aurora") return <MeshOrb size={size} />;
  return <GlossyOrb size={size} />;
}
