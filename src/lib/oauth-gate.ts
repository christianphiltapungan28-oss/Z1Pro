import { cookies } from "next/headers";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { oauthAccounts, userPasswords, users } from "@/db/schema";
import { getTwoFactor, issueLoginTicket } from "@/lib/two-factor";

/** Holds the two-factor ticket after a Google/Facebook sign-in, until the code is entered. */
export const OAUTH_TICKET_COOKIE = "z1p-2fa-ticket";

// Providers whose sign-in joins an existing account with the same email
// (allowDangerousEmailAccountLinking in src/auth.ts).
const LINKS_BY_EMAIL = new Set(["google"]);

/**
 * Checks a Google/Facebook sign-in before Auth.js makes a session. Returns
 * true to carry on, or a /login URL: when the provider gave no email, when the
 * email belongs to an account it won't join (saying which method to use), or
 * when that account has two-factor on, so the code is asked first.
 */
export async function checkOAuthSignIn(
  email: string | null | undefined,
  provider: string,
  providerAccountId: string
): Promise<true | string> {
  if (!email) return "/login?error=NoEmail";

  const [linked] = await db
    .select({ userId: oauthAccounts.userId })
    .from(oauthAccounts)
    .where(and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.providerUserId, providerAccountId)))
    .limit(1);

  let userId = linked?.userId;
  if (!userId) {
    const [byEmail] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(sql`lower(${users.email}) = ${email.trim().toLowerCase()}`, isNull(users.deletedAt)))
      .limit(1);
    if (!byEmail) return true; // a new account
    if (!LINKS_BY_EMAIL.has(provider)) return `/login?error=${await otherMethod(byEmail.id)}`;
    userId = byEmail.id;
  }

  if (!(await getTwoFactor(userId)).row) return true;

  (await cookies()).set(OAUTH_TICKET_COOKIE, await issueLoginTicket(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 5 * 60,
  });
  return `/login?tab=2fa&callbackUrl=${encodeURIComponent(await callbackPath())}`;
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
