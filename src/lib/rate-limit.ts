import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// INCR and set the expiry in one atomic step. Doing them as two calls could
// leave a key with no TTL if the second call failed, locking the user out
// forever; this also costs one Upstash request instead of two or three.
const INCR_WITH_TTL = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
if ttl < 0 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {count, ttl}
`;

/**
 * Fixed-window rate limiter backed by Upstash Redis, keyed by an arbitrary
 * string (e.g. `${route}:${userId}`). Durable across redeploys and shared
 * across server instances, unlike an in-process counter.
 */
export async function rateLimit(key: string, limit: number, windowMs: number) {
  const [count, ttlMs] = (await redis.eval(
    INCR_WITH_TTL,
    [`ratelimit:${key}`],
    [String(windowMs)]
  )) as [number, number];

  if (count > limit) {
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(ttlMs / 1000)) };
  }
  return { ok: true, retryAfterSeconds: 0 };
}

/** Best-effort client IP, for limiting requests that have no signed-in user. */
export function clientIp(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (xff) return xff;
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
