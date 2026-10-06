/**
 * Placeholder shapes shown while content loads, in place of "Loading…" text.
 * Grey blocks in the layout's shape (bg-flow-line works in both themes),
 * pulsing unless the person prefers reduced motion. Screen readers hear one
 * "Loading" from the wrapper; the blocks themselves are hidden from them.
 */

export function Skeleton({ className = "" }: { className?: string }) {
  // Default corners only when none are given: two rounded-* classes on one
  // element resolve by stylesheet order, not class order.
  const corners = /\brounded/.test(className) ? "" : "rounded-md";
  return (
    <span
      aria-hidden="true"
      className={`block bg-flow-line motion-safe:animate-pulse ${corners} ${className}`}
    />
  );
}

/** Wrapper that announces loading once. Pass the layout-shaped blocks as children. */
export function SkeletonGroup({
  label = "Loading",
  className = "",
  children,
}: {
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Three plan cards (Upgrade dialog, Settings → Subscription). Pass the grid classes. */
export function PlanCardsSkeleton({ className = "" }: { className?: string }) {
  return (
    <SkeletonGroup label="Loading plans" className={className}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-3 rounded-2xl border border-card-border p-5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-3 w-4/5" />
          <span className="mt-2 flex flex-col gap-2.5">
            {["w-3/4", "w-2/3", "w-4/5"].map((width) => (
              <Skeleton key={width} className={`h-3 ${width}`} />
            ))}
          </span>
          <Skeleton className="mt-3 h-10 w-full rounded-full" />
        </div>
      ))}
    </SkeletonGroup>
  );
}
