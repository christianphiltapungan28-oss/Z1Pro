import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Fixed-window rate limiter backed by Upstash Redis, keyed by an arbitrary
 * string (e.g. `${route}:${userId}`). Durable across redeploys and shared
 * across server instances, unlike an in-process counter.
 */
export async function rateLimit(key: string, limit: number, windowMs: number) {
  const redisKey = `ratelimit:${key}`;
  const windowSeconds = Math.ceil(windowMs / 1000);

  const count = await redis.incr(redisKey);
  if (count === 1) {
    await redis.expire(redisKey, windowSeconds);
  }

  if (count > limit) {
    const ttl = await redis.ttl(redisKey);
    return { ok: false, retryAfterSeconds: ttl > 0 ? ttl : windowSeconds };
  }

  return { ok: true, retryAfterSeconds: 0 };
}
