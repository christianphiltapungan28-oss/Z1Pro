import { createHmac, timingSafeEqual } from "node:crypto";
import { emailLink } from "@/lib/email";

// Unsubscribe links in marketing emails work without signing in, so they
// carry a signature (HMAC of the user id with AUTH_SECRET) instead.

function sign(userId: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHmac("sha256", secret).update(`unsubscribe:marketing:${userId}`).digest("base64url");
}

export function unsubscribeLink(userId: string) {
  return emailLink(`/api/unsubscribe?u=${userId}&t=${sign(userId)}`);
}

export function validUnsubscribe(userId: string, token: string) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return false;
  const given = Buffer.from(token);
  const expected = Buffer.from(sign(userId));
  return given.length === expected.length && timingSafeEqual(given, expected);
}
