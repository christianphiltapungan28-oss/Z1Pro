import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { emailConfigured, emailLink, sendEmail } from "@/lib/email";
import { hashPassword, passwordProblem } from "@/lib/password";
import { issueToken, type PendingSignup } from "@/lib/password-tokens";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function cleanName(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 40) : "";
}

/**
 * Create an account with email + password (Figma "Authentication — Sign
 * Up"). Nothing is created yet: we email a confirmation link, and the
 * account exists only once it's clicked (/api/password/confirm), so no one
 * can claim an address they don't own. The reply is the same whether or not
 * the email already has an account.
 */
export async function POST(request: Request) {
  if (!emailConfigured()) {
    return NextResponse.json(
      { error: "Creating an account with email isn't available yet. Use Google or Facebook." },
      { status: 503 }
    );
  }
  const limit = await rateLimit(`signup:${clientIp(request)}`, 5, 60 * 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many sign-ups from here. Try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const firstName = cleanName(body?.firstName);
  const lastName = cleanName(body?.lastName);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (body?.agreed !== true) {
    return NextResponse.json({ error: "Agree to the Terms of Use and Privacy Policy to continue." }, { status: 400 });
  }
  if (!firstName) {
    return NextResponse.json({ error: "Enter your first name." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const problem = passwordProblem(password);
  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400 });
  }
  const emailLimit = await rateLimit(`signup:email:${email}`, 3, 60 * 60_000);
  if (!emailLimit.ok) {
    return NextResponse.json({ error: "We already sent a link to that email. Check your inbox." }, { status: 429 });
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);

  if (existing) {
    // Tell the owner instead of the person filling in the form.
    await sendEmail({
      to: email,
      subject: "You already have a Z1P account",
      heading: "You already have an account",
      body: "Someone tried to create a Z1P account with this email, but you already have one. Sign in with the method you used before, or reset your password to add one.",
      button: { label: "Reset password", url: emailLink("/login?tab=forgot") },
      footer: "If this wasn't you, you can ignore this email.",
    });
  } else {
    const token = await issueToken<PendingSignup>("signup", {
      email,
      name: [firstName, lastName].filter(Boolean).join(" "),
      passwordHash: await hashPassword(password),
    });
    const sent = await sendEmail({
      to: email,
      subject: "Confirm your Z1P account",
      heading: `Welcome to Z1P, ${firstName}`,
      body: "Confirm your email to finish creating your account. The link works once and expires in 24 hours.",
      button: { label: "Confirm email", url: emailLink(`/api/password/confirm?token=${token}`) },
      footer: "If you didn't sign up for Z1P, you can ignore this email.",
    });
    if (!sent) {
      return NextResponse.json({ error: "Couldn't send the confirmation email. Please try again." }, { status: 502 });
    }
  }

  return NextResponse.json({ ok: true, email });
}
