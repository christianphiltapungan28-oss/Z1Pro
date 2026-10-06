import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginScreen } from "@/components/login-screen";
import { NOT_INVITED } from "@/lib/beta";
import { OAUTH_TICKET_COOKIE } from "@/lib/oauth-gate";
import { safeCallback } from "@/lib/safe-callback";

export const metadata: Metadata = {
  title: "Sign in — Z1P.pro",
};

const ERRORS: Record<string, string> = {
  OAuthAccountNotLinked:
    "That email is already linked to a different sign-in method. Use the one you signed up with.",
  AccessDenied: "Sign-in was cancelled or not allowed.",
  LinkExpired:
    "That confirmation link has expired or was already used. Create your account again to get a new one.",
  AccountExists:
    "There's already an account with that email. Log in instead, or reset your password.",
  PasswordsUnavailable:
    "Creating an account with email isn't available yet. Use Google or Facebook.",
  NotInvited: NOT_INVITED,
  NoEmail:
    "Your Facebook account didn't share an email address, and Z1P needs one. Add an email in Facebook, or use Google or email instead.",
  UseGoogle: "There's already an account with that email. Sign in with Google instead.",
  UsePassword:
    "There's already an account with that email. Log in with your email and password instead.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const callbackUrl = safeCallback(params.callbackUrl);

  const session = await auth();
  if (session?.user) redirect(callbackUrl);

  // Google/Facebook sign-in for an account with two-factor on (src/lib/oauth-gate.ts).
  const twoFactorPending = params.tab === "2fa" && (await cookies()).has(OAUTH_TICKET_COOKIE);
  const view = params.tab === "signup" ? "signup" : params.tab === "forgot" ? "forgot" : "signin";
  const errorCode = Array.isArray(params.error) ? params.error[0] : params.error;
  const error = errorCode
    ? (ERRORS[errorCode] ?? "Something went wrong signing you in. Please try again.")
    : null;

  return (
    <LoginScreen
      view={view}
      callbackUrl={callbackUrl}
      error={error}
      twoFactorPending={twoFactorPending}
    />
  );
}
