import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { rateLimit, redis } from "@/lib/rate-limit";

// One-time codes for confirming a new email address or phone number. The
// pending value and a hash of the code live in Redis for 10 minutes; five
// wrong guesses cancel the code.

export type OtpPurpose = "email" | "phone";

const TTL_SECONDS = 10 * 60;
const MAX_ATTEMPTS = 5;
const RESEND_SECONDS = 30;

type Pending = { target: string; hash: string; attempts: number };

const key = (purpose: OtpPurpose, userId: string) => `otp:${purpose}:${userId}`;

function hashCode(userId: string, code: string) {
  return createHash("sha256").update(`${userId}:${code}`).digest("hex");
}

/**
 * Makes a new code for `target` (the new email or phone). Returns the code
 * to send, or an error message when the user is asking too often.
 */
export async function createOtp(purpose: OtpPurpose, userId: string, target: string) {
  const cooldown = await redis.set(`${key(purpose, userId)}:cooldown`, "1", {
    nx: true,
    ex: RESEND_SECONDS,
  });
  if (!cooldown) {
    return { error: `Wait ${RESEND_SECONDS} seconds before asking for another code.` } as const;
  }
  const limit = await rateLimit(`otp:${purpose}:${userId}`, 5, 60 * 60_000);
  if (!limit.ok) {
    return { error: "Too many codes requested. Try again in an hour." } as const;
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const pending: Pending = { target, hash: hashCode(userId, code), attempts: 0 };
  await redis.set(key(purpose, userId), pending, { ex: TTL_SECONDS });
  return { code } as const;
}

/** Checks a code. On success returns the confirmed target and clears it. */
export async function verifyOtp(purpose: OtpPurpose, userId: string, code: string) {
  const pending = await redis.get<Pending>(key(purpose, userId));
  if (!pending) {
    return { error: "That code has expired. Ask for a new one." } as const;
  }
  const given = Buffer.from(hashCode(userId, code.trim()));
  const expected = Buffer.from(pending.hash);
  if (given.length === expected.length && timingSafeEqual(given, expected)) {
    await redis.del(key(purpose, userId));
    return { target: pending.target } as const;
  }
  const attempts = pending.attempts + 1;
  if (attempts >= MAX_ATTEMPTS) {
    await redis.del(key(purpose, userId));
    return { error: "Too many wrong codes. Ask for a new one." } as const;
  }
  await redis.set(key(purpose, userId), { ...pending, attempts }, { keepTtl: true });
  return { error: "That code isn't right. Check it and try again." } as const;
}
