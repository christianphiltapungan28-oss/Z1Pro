export function AmbientBackground() {
  return (
    <div
      className="ambient-background pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      <div
        className="absolute -top-32 -right-32 h-[360px] w-[360px] rounded-full blur-[120px]"
        style={{ background: "var(--blob-a)", opacity: "var(--blob-opacity)" }}
      />
      <div
        className="absolute -bottom-40 -left-28 h-[320px] w-[320px] rounded-full blur-[120px]"
        style={{ background: "var(--blob-b)", opacity: "var(--blob-opacity)" }}
      />
      <div
        className="absolute -bottom-24 right-8 h-[260px] w-[260px] rounded-full blur-[120px]"
        style={{ background: "var(--blob-b)", opacity: "calc(var(--blob-opacity) * 0.6)" }}
      />
    </div>
  );
}
