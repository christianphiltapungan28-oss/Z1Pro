import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { oauthAccounts, sessions, userPasswords, users } from "@/db/schema";
import { getTwoFactor, issueLoginTicket, type PendingLink } from "@/lib/two-factor";

/** Holds the two-factor ticket after a Google/Facebook sign-in, until the code is entered. */
export const OAUTH_TICKET_COOKIE = "z1p-2fa-ticket";

// Providers whose sign-in joins an existing account with the same email
// (allowDangerousEmailAccountLinking in src/auth.ts).
const LINKS_BY_EMAIL = new Set(["google"]);

/** Settings → Privacy & Security, where accounts are connected. */
export const CONNECT_RETURN = "/?view=settings";

/** The user behind this request's session cookie, if it's a live session. */
async function signedInUserId() {
  const jar = await cookies();
  const token = jar.get("__Secure-authjs.session-token")?.value ?? jar.get("authjs.session-token")?.value;
  if (!token) return null;
  const [row] = await db
    .select({ userId: sessions.userId, expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(and(eq(sessions.tokenHash, createHash("sha256").update(token).digest("hex")), isNull(sessions.revokedAt)))
    .limit(1);
  return row && row.expiresAt.getTime() > Date.now() ? row.userId : null;
}

/**
 * Checks a Google/Facebook sign-in before Auth.js makes a session. Returns
 * true to carry on, or a /login URL: when the provider gave no email, when the
 * email belongs to an account it won't join (saying which method to use), or
 * when that account has two-factor on, so the code is asked first.
 *
 * Someone already signed in is connecting the account in Settings: Auth.js
 * links it to them, unless it belongs to another Z1P account.
 */
export async function checkOAuthSignIn(
  email: string | null | undefined,
  provider: string,
  providerAccountId: string
): Promise<true | string> {
  const [linked] = await db
    .select({ userId: oauthAccounts.userId })
    .from(oauthAccounts)
    .where(and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.providerUserId, providerAccountId)))
    .limit(1);

  const signedIn = await signedInUserId();
  if (signedIn) {
    return linked && linked.userId !== signedIn ? `${CONNECT_RETURN}&connect=taken` : true;
  }

  if (!email) return "/login?error=NoEmail";

  let userId = linked?.userId;
  let link: PendingLink | undefined;
  if (!userId) {
    const [byEmail] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(sql`lower(${users.email}) = ${email.trim().toLowerCase()}`, isNull(users.deletedAt)))
      .limit(1);
    if (!byEmail) return true; // a new account
    if (!LINKS_BY_EMAIL.has(provider)) return `/login?error=${await otherMethod(byEmail.id)}`;
    userId = byEmail.id;
    // Auth.js won't link it once we redirect, so the code step does.
    link = { provider, providerAccountId, email };
  }

  if (!(await getTwoFactor(userId)).row) return true;

  (await cookies()).set(OAUTH_TICKET_COOKIE, await issueLoginTicket(userId, link), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 5 * 60,
  });
  return `/login?tab=2fa&callbackUrl=${encodeURIComponent(await callbackPath())}`;
}

/**
 * Links a Google/Facebook account to a user. Returns false when that account
 * already belongs to someone else; linking it again to the same user is a no-op.
 */
export async function linkOAuthAccount(userId: string, link: PendingLink) {
  const [existing] = await db
    .select({ userId: oauthAccounts.userId })
    .from(oauthAccounts)
    .where(and(eq(oauthAccounts.provider, link.provider), eq(oauthAccounts.providerUserId, link.providerAccountId)))
    .limit(1);
  if (existing) return existing.userId === userId;
  await db.insert(oauthAccounts).values({
    userId,
    provider: link.provider,
    providerUserId: link.providerAccountId,
    emailAtProvider: link.email,
  });
  return true;
}

/** Error code naming how the existing account signs in (messages on /login). */
async function otherMethod(userId: string) {
  const [google] = await db
    .select({ id: oauthAccounts.id })
    .from(oauthAccounts)
    .where(and(eq(oauthAccounts.userId, userId), eq(oauthAccounts.provider, "google")))
    .limit(1);
  if (google) return "UseGoogle";
  const [password] = await db
    .select({ id: userPasswords.userId })
    .from(userPasswords)
    .where(eq(userPasswords.userId, userId))
    .limit(1)
    .catch(() => []);
  return password ? "UsePassword" : "OAuthAccountNotLinked";
}

/** Where the person was heading, from Auth.js's callback-url cookie, as a same-site path. */
async function callbackPath() {
  const jar = await cookies();
  const value = jar.get("__Secure-authjs.callback-url")?.value ?? jar.get("authjs.callback-url")?.value;
  if (!value) return "/";
  try {
    const url = new URL(value, "http://x");
    return `${url.pathname}${url.search}`;
  } catch {
    return "/";
  }
}
