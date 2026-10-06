import { createHash, randomUUID } from "node:crypto";
import type { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { clientIp } from "@/lib/rate-limit";

// Auth.js's default session length (30 days), so password sign-ins behave
// like Google/Facebook ones; Auth.js extends the session as it's used.
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * Auth.js's Credentials provider can't use database sessions, so password
 * sign-in makes the session itself: the same `sessions` row and cookie the
 * adapter makes (src/lib/auth-adapter.ts), which Auth.js then reads as usual.
 */
export async function startSession(response: NextResponse, request: Request, userId: string) {
  const token = randomUUID();
  const expires = new Date(Date.now() + MAX_AGE_SECONDS * 1000);
  await db.insert(sessions).values({
    userId,
    tokenHash: createHash("sha256").update(token).digest("hex"),
    userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    ipAddress: clientIp(request),
    expiresAt: expires,
  });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));

  // Auth.js uses the __Secure- cookie on HTTPS.
  const forwarded = request.headers.get("x-forwarded-proto");
  const secure =
    (process.env.AUTH_URL ?? "").startsWith("https:") ||
    (forwarded
      ? forwarded.split(",")[0].trim() === "https"
      : new URL(request.url).protocol === "https:");
  response.cookies.set(secure ? "__Secure-authjs.session-token" : "authjs.session-token", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    expires,
  });
  return response;
}
