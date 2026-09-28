import { NextResponse } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { userPasswords, users } from "@/db/schema";
import { isMissingTable } from "@/lib/db-errors";
import { dummyHash, verifyPassword } from "@/lib/password";
import { startSession } from "@/lib/password-session";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const WRONG = "That email and password don't match. Try again or reset your password.";

/** Log in with email + password (Figma "Authentication — Log In"). */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password || password.length > 200) {
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  }

  const ipLimit = await rateLimit(`login:ip:${clientIp(request)}`, 20, 15 * 60_000);
  const emailLimit = await rateLimit(`login:email:${email}`, 10, 15 * 60_000);
  if (!ipLimit.ok || !emailLimit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Wait 15 minutes or reset your password." },
      { status: 429 }
    );
  }

  let row: { userId: string; hash: string } | undefined;
  try {
    [row] = await db
      .select({ userId: users.id, hash: userPasswords.passwordHash })
      .from(users)
      .innerJoin(userPasswords, eq(userPasswords.userId, users.id))
      .where(and(sql`lower(${users.email}) = ${email}`, isNull(users.deletedAt)))
      .limit(1);
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json(
        { error: "Signing in with a password isn't available yet. Use Google or Facebook." },
        { status: 503 }
      );
    }
    throw err;
  }

  // Check a hash either way, so an unknown email isn't faster to reject.
  const ok = await verifyPassword(password, row?.hash ?? (await dummyHash()));
  if (!row || !ok) {
    return NextResponse.json({ error: WRONG }, { status: 401 });
  }

  return startSession(NextResponse.json({ ok: true }), request, row.userId);
}
