import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginScreen } from "@/components/login-screen";

export const metadata: Metadata = {
  title: "Sign in — Z1P.pro",
};

// Only same-site paths, so a crafted link can't bounce people elsewhere.
function safeCallback(value: string | string[] | undefined) {
  const url = Array.isArray(value) ? value[0] : value;
  return url && url.startsWith("/") && !url.startsWith("//") ? url : "/";
}

const ERRORS: Record<string, string> = {
  OAuthAccountNotLinked:
    "That email is already linked to a different sign-in method. Use the one you signed up with.",
  AccessDenied: "Sign-in was cancelled or not allowed.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const callbackUrl = safeCallback(params.callbackUrl);

  const session = await auth();
  if (session?.user) redirect(callbackUrl);

  const tab = params.tab === "signup" ? "signup" : "signin";
  const errorCode = Array.isArray(params.error) ? params.error[0] : params.error;
  const error = errorCode
    ? (ERRORS[errorCode] ?? "Something went wrong signing you in. Please try again.")
    : null;

  return <LoginScreen tab={tab} callbackUrl={callbackUrl} error={error} />;
}
