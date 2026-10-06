import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { oauthAccounts, userPasswords } from "@/db/schema";
import { isMissingTable } from "@/lib/db-errors";
import { rateLimit } from "@/lib/rate-limit";

const PROVIDERS = ["google", "facebook"];

/**
 * Disconnect Google or Facebook: DELETE { provider }. Refused when it's the
 * only way left to sign in. Connecting is a normal Auth.js sign-in while
 * signed in (src/lib/oauth-gate.ts).
 */
export async function DELETE(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await rateLimit(`settings:connections:${userId}`, 10, 10 * 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many changes. Try again shortly." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const provider = typeof body?.provider === "string" ? body.provider : "";
  if (!PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "Unknown account type" }, { status: 400 });
  }

  const linked = await db
    .select({ provider: oauthAccounts.provider })
    .from(oauthAccounts)
    .where(eq(oauthAccounts.userId, userId));
  if (!linked.some((l) => l.provider === provider)) {
    return NextResponse.json({ ok: true });
  }

  const hasPassword = await db
    .select({ id: userPasswords.userId })
    .from(userPasswords)
    .where(eq(userPasswords.userId, userId))
    .limit(1)
    .then((rows) => rows.length > 0)
    .catch((err) => {
      if (isMissingTable(err)) return false;
      throw err;
    });
  if (!hasPassword && !linked.some((l) => l.provider !== provider)) {
    return NextResponse.json(
      {
        error:
          "This is the only way you sign in to Z1P. Connect another account or set a password (Forgot password on the log-in page) first.",
      },
      { status: 400 },
    );
  }

  await db
    .delete(oauthAccounts)
    .where(and(eq(oauthAccounts.userId, userId), eq(oauthAccounts.provider, provider)));
  return NextResponse.json({ ok: true });
}
