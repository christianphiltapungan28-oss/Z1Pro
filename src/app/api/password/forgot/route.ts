import { NextResponse } from "next/server";
import { and, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { emailConfigured, emailLink, sendEmail } from "@/lib/email";
import { issueToken } from "@/lib/password-tokens";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * Forgot password (Figma "Authentication — Forgot Password"). Emails a
 * one-hour reset link if the address has an account — including Google or
 * Facebook accounts, which is how they add a password. The reply never says
 * whether the account exists.
 */
export async function POST(request: Request) {
  if (!emailConfigured()) {
    return NextResponse.json({ error: "Password reset isn't available yet." }, { status: 503 });
  }
  const body = await request.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email.includes("@") || email.length > 254) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const ipLimit = await rateLimit(`forgot:ip:${clientIp(request)}`, 10, 60 * 60_000);
  const emailLimit = await rateLimit(`forgot:email:${email}`, 3, 60 * 60_000);
  if (!ipLimit.ok || !emailLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again in an hour." },
      { status: 429 },
    );
  }

  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(sql`lower(${users.email}) = ${email}`, isNull(users.deletedAt)))
    .limit(1);

  if (user) {
    const token = await issueToken("reset", { userId: user.id });
    await sendEmail({
      to: user.email,
      subject: "Reset your Z1P password",
      heading: "Reset your password",
      body: "Use the button below to choose a new password. The link works once and expires in 1 hour.",
      button: { label: "Choose a new password", url: emailLink(`/reset-password?token=${token}`) },
      footer:
        "If you didn't ask to reset your password, you can ignore this email; your password won't change.",
    });
  }

  return NextResponse.json({ ok: true });
}
