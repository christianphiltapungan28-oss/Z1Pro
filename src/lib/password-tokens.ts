import { createHash, randomBytes } from "node:crypto";
import { redis } from "@/lib/rate-limit";

// Single-use links for confirming a new password account and resetting a
// password. Redis stores the payload under a hash of the token, so a leaked
// Redis dump holds no working links.

type Kind = "signup" | "reset";

/** A sign-up waiting for its email link to be clicked. */
export type PendingSignup = { email: string; name: string; passwordHash: string };

const TTL: Record<Kind, number> = { signup: 24 * 60 * 60, reset: 60 * 60 };

const key = (kind: Kind, token: string) =>
  `pw:${kind}:${createHash("sha256").update(token).digest("hex")}`;

export async function issueToken<T>(kind: Kind, payload: T) {
  const token = randomBytes(32).toString("base64url");
  await redis.set(key(kind, token), payload, { ex: TTL[kind] });
  return token;
}

/** Returns the payload once; the link stops working after this. */
export async function redeemToken<T>(kind: Kind, token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  return (await redis.getdel<T>(key(kind, token))) ?? null;
}
