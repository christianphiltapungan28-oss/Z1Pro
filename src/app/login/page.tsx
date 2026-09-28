import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginScreen } from "@/components/login-screen";

export const metadata: Metadata = {
  title: "Sign in — Z1P.pro",
};

// Only same-site paths, so a crafted link can't bounce people elsewhere
// ("//host" and "/\host" are treated as other sites by browsers).
function safeCallback(value: string | string[] | undefined) {
  const url = Array.isArray(value) ? value[0] : value;
  return url && url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/\\") ? url : "/";
}

const ERRORS: Record<string, string> = {
  OAuthAccountNotLinked:
    "That email is already linked to a different sign-in method. Use the one you signed up with.",
  AccessDenied: "Sign-in was cancelled or not allowed.",
  LinkExpired: "That confirmation link has expired or was already used. Create your account again to get a new one.",
  AccountExists: "There's already an account with that email. Log in instead, or reset your password.",
  PasswordsUnavailable: "Creating an account with email isn't available yet. Use Google or Facebook.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const callbackUrl = safeCallback(params.callbackUrl);

  const session = await auth();
  if (session?.user) redirect(callbackUrl);

  const view = params.tab === "signup" ? "signup" : params.tab === "forgot" ? "forgot" : "signin";
  const errorCode = Array.isArray(params.error) ? params.error[0] : params.error;
  const error = errorCode
    ? (ERRORS[errorCode] ?? "Something went wrong signing you in. Please try again.")
    : null;

  return <LoginScreen view={view} callbackUrl={callbackUrl} error={error} />;
}
