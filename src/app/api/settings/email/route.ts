import { NextResponse } from "next/server";
import { and, eq, ne, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { emailConfigured, sendEmail } from "@/lib/email";
import { createOtp, verifyOtp } from "@/lib/otp";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Change the account email (mobile Figma "Dialog / Update email").
 * POST { step: "send", email } emails a 6-digit code to the new address;
 * POST { step: "verify", code } confirms it and switches the email. Sign-in
 * still goes through Google or Facebook; this is the address Z1P writes to.
 */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!emailConfigured()) {
    return NextResponse.json({ error: "Changing your email isn't available yet." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));

  if (body?.step === "send") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!EMAIL_RE.test(email) || email.length > 254) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(sql`lower(${users.email}) = ${email}`, ne(users.id, userId)))
      .limit(1);
    if (taken) {
      return NextResponse.json({ error: "That email is already used by another account." }, { status: 409 });
    }
    const otp = await createOtp("email", userId, email);
    if ("error" in otp) {
      return NextResponse.json({ error: otp.error }, { status: 429 });
    }
    const sent = await sendEmail({
      to: email,
      subject: `${otp.code} is your Z1P code`,
      heading: "Confirm your new email",
      body: `Your Z1P verification code is ${otp.code}. It expires in 10 minutes. If you didn't ask to change your email, you can ignore this.`,
      footer: "You get this because someone asked to use this address for a Z1P account.",
    });
    if (!sent) {
      return NextResponse.json({ error: "Couldn't send the code. Please try again." }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body?.step === "verify") {
    const code = typeof body.code === "string" ? body.code : "";
    if (!/^\d{6}$/.test(code.trim())) {
      return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 });
    }
    const result = await verifyOtp("email", userId, code);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const [before] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    try {
      await db
        .update(users)
        .set({ email: result.target, emailVerifiedAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, userId));
    } catch {
      return NextResponse.json({ error: "That email is already used by another account." }, { status: 409 });
    }
    // Tell the old address, in case this wasn't the account owner.
    if (before?.email && before.email !== result.target) {
      await sendEmail({
        to: before.email,
        subject: "Your Z1P email was changed",
        heading: "Your email was changed",
        body: `The email on your Z1P account is now ${result.target}. If you didn't do this, sign in and change it back, or contact Z1P support.`,
        footer: "This is a security notice about your Z1P account.",
      });
    }
    return NextResponse.json({ email: result.target });
  }

  return NextResponse.json({ error: "Unknown step" }, { status: 400 });
}
