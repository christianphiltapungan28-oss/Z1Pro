type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Prevent unbounded growth from one-off keys (e.g. deleted users).
const cleanup = setInterval(
  () => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  },
  5 * 60_000
);
cleanup.unref?.();

/**
 * In-memory fixed-window rate limiter keyed by an arbitrary string
 * (e.g. `${route}:${userId}`). Per-process only — fine for a single
 * server instance, but resets if the process restarts and isn't shared
 * across instances in a multi-instance/serverless deployment. Swap in
 * a durable store (e.g. Redis) if you scale beyond one instance.
 */
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;
  return { ok: true, retryAfterSeconds: 0 };
}
