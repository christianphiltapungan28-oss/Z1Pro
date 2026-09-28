import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { userPasswords, users } from "@/db/schema";
import { getAppOrigin } from "@/lib/app-url";
import { isMissingTable } from "@/lib/db-errors";
import { startSession } from "@/lib/password-session";
import { redeemToken, type PendingSignup } from "@/lib/password-tokens";
import { createPersonalOrg } from "@/lib/personal-org";

/** The link in the sign-up email: creates the account and signs in. */
export async function GET(request: Request) {
  const origin = getAppOrigin(request);
  const back = (error: string) => NextResponse.redirect(new URL(`/login?tab=signup&error=${error}`, origin));

  const token = new URL(request.url).searchParams.get("token") ?? "";
  const pending = await redeemToken<PendingSignup>("signup", token);
  if (!pending) return back("LinkExpired");

  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${pending.email}`)
    .limit(1);
  if (taken) return back("AccountExists");

  let userId: string;
  try {
    userId = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({ email: pending.email, emailVerifiedAt: new Date(), displayName: pending.name })
        .returning({ id: users.id });
      await tx.insert(userPasswords).values({ userId: user.id, passwordHash: pending.passwordHash });
      return user.id;
    });
  } catch (err) {
    if (isMissingTable(err)) return back("PasswordsUnavailable");
    throw err;
  }
  await createPersonalOrg({ id: userId, name: pending.name, email: pending.email });

  return startSession(NextResponse.redirect(new URL("/", origin)), request, userId);
}
