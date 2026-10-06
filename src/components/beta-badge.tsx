/** The "Beta" pill beside the logo. Remove at launch. */
export function BetaBadge({ className = "bg-accent/10 text-accent" }: { className?: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase ${className}`}
    >
      Beta
    </span>
  );
}
