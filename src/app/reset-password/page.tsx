import type { Metadata } from "next";
import { LoginScreen } from "@/components/login-screen";
import { ResetPasswordForm } from "@/components/reset-password-form";

export const metadata: Metadata = {
  title: "Choose a new password — Z1P.pro",
  // The URL carries a single-use token; keep it out of search and referrers.
  robots: { index: false },
  referrer: "no-referrer",
};

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  return (
    <LoginScreen>
      <ResetPasswordForm token={token} />
    </LoginScreen>
  );
}
