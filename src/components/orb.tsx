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
        className="absolute inset-[-25%] rounded-full opacity-60 blur-2xl"
        style={{
          background:
            "conic-gradient(from 45deg, #ffd3e0, #cfe0ff, #e7d6ff, #ffd3e0)",
          animation: "orb-drift 6s ease-in-out infinite",
        }}
      />
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 38% 32%, #ffffff 0%, #f3ecff 30%, #dcebff 60%, #f6d9e6 100%)",
          boxShadow:
            "0 8px 30px rgba(150,140,220,0.25), inset 0 0 20px rgba(255,255,255,0.6)",
        }}
      >
        <svg
          className="absolute inset-0 h-full w-full opacity-70"
          viewBox="0 0 100 100"
          style={{ animation: "orb-spin 22s linear infinite" }}
        >
          <path
            d="M20 45c10-20 35-25 45-10s-5 30-20 28-25-8-25-18Z"
            fill="none"
            stroke="#b9c9ff"
            strokeWidth="2"
          />
          <path
            d="M30 60c15 12 40 8 45-8"
            fill="none"
            stroke="#f3b8cf"
            strokeWidth="2"
          />
          <path
            d="M35 30c8-6 20-4 24 4"
            fill="none"
            stroke="#c9b8f3"
            strokeWidth="1.5"
          />
        </svg>
      </div>
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
