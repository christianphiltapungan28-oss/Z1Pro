import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { auth } from "@/auth";
import { db } from "@/db";
import { userPasswords, users, userTwoFactor } from "@/db/schema";
import { isMissingTable } from "@/lib/db-errors";
import { rateLimit, redis } from "@/lib/rate-limit";
import { seal } from "@/lib/secret-box";
import { newTotpSecret, totpUri, verifyTotp } from "@/lib/totp";
import { checkSecondFactor, getTwoFactor, newBackupCodes } from "@/lib/two-factor";

const pendingKey = (userId: string) => `2fa:setup:${userId}`;

/**
 * Two-factor login for password accounts (Settings → Privacy & Security).
 * POST { step: "start" } — a new secret and its QR code (kept pending 10 min);
 * POST { step: "enable", code } — confirm with a code; returns backup codes once;
 * POST { step: "disable", code } — turn off with a current or backup code.
 */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limit = await rateLimit(`2fa:settings:${userId}`, 20, 15 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in 15 minutes." },
      { status: 429 },
    );
  }

  const status = await getTwoFactor(userId);
  if (!status.ready) {
    return NextResponse.json({ error: "Two-factor login isn't available yet." }, { status: 503 });
  }
  const [hasPassword] = await db
    .select({ id: userPasswords.userId })
    .from(userPasswords)
    .where(eq(userPasswords.userId, userId))
    .limit(1)
    .catch((err) => {
      if (isMissingTable(err)) return [];
      throw err;
    });

  const body = await request.json().catch(() => ({}));
  const code = typeof body?.code === "string" ? body.code.slice(0, 20) : "";

  if (body?.step === "start") {
    if (!hasPassword) {
      return NextResponse.json(
        {
          error:
            "Two-factor login protects password log-ins. Set a password first (Forgot Password on the log-in page).",
        },
        { status: 409 },
      );
    }
    if (status.row) {
      return NextResponse.json({ error: "Two-factor login is already on." }, { status: 409 });
    }
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const secret = newTotpSecret();
    await redis.set(pendingKey(userId), secret, { ex: 10 * 60 });
    const uri = totpUri(secret, user?.email ?? "account");
    const qr = await QRCode.toDataURL(uri, { margin: 1, width: 220, errorCorrectionLevel: "M" });
    return NextResponse.json({ secret, uri, qr });
  }

  if (body?.step === "enable") {
    const secret = await redis.get<string>(pendingKey(userId));
    if (!secret) {
      return NextResponse.json({ error: "Setup timed out. Start again." }, { status: 400 });
    }
    if (verifyTotp(secret, code) === null) {
      return NextResponse.json(
        {
          error:
            "That code isn't right. Check the time on your phone is set automatically, then try the newest code.",
        },
        { status: 400 },
      );
    }
    const backup = newBackupCodes();
    await db
      .insert(userTwoFactor)
      .values({ userId, secretCiphertext: seal(secret), backupCodeHashes: backup.hashes })
      .onConflictDoNothing();
    await redis.del(pendingKey(userId));
    return NextResponse.json({ backupCodes: backup.codes });
  }

  if (body?.step === "disable") {
    if (!status.row) {
      return NextResponse.json({ ok: true });
    }
    if (!(await checkSecondFactor(userId, code))) {
      return NextResponse.json({ error: "That code isn't right." }, { status: 400 });
    }
    await db.delete(userTwoFactor).where(eq(userTwoFactor.userId, userId));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown step" }, { status: 400 });
}
