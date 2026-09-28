import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { sessions, userPasswords } from "@/db/schema";
import { isMissingTable } from "@/lib/db-errors";
import { hashPassword, passwordProblem } from "@/lib/password";
import { startSession } from "@/lib/password-session";
import { redeemToken } from "@/lib/password-tokens";

/**
 * POST { token, password } from the reset-password page. Sets the new
 * password, signs out every other device, and signs in here.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const problem = passwordProblem(password);
  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400 });
  }

  const payload = await redeemToken<{ userId: string }>("reset", token);
  if (!payload) {
    return NextResponse.json(
      { error: "This reset link has expired or was already used. Ask for a new one." },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(password);
  try {
    await db
      .insert(userPasswords)
      .values({ userId: payload.userId, passwordHash })
      .onConflictDoUpdate({
        target: userPasswords.userId,
        set: { passwordHash, updatedAt: new Date() },
      });
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: "Password sign-in isn't available yet." }, { status: 503 });
    }
    throw err;
  }
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, payload.userId), isNull(sessions.revokedAt)));

  return startSession(NextResponse.json({ ok: true }), request, payload.userId);
}
