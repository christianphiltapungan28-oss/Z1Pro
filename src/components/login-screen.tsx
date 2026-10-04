import Link from "next/link";
import { LoginForm, type AuthView } from "@/components/login-form";
import { Logo } from "@/components/logo";

/** The auth screen from the Figma file: brand panel plus the form. */
export function LoginScreen({
  view,
  callbackUrl,
  error,
  twoFactorPending,
  children,
}: {
  view?: AuthView;
  callbackUrl?: string;
  error?: string | null;
  /** Google/Facebook sign-in is waiting for the two-factor code. */
  twoFactorPending?: boolean;
  /** Replaces the sign-in form (e.g. the reset-password page). */
  children?: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-dvh overflow-y-auto bg-background">
      <aside className="relative hidden w-[500px] shrink-0 overflow-hidden border-r border-field-border bg-accent lg:block">
        <Link href="/" aria-label="Z1P.pro home" className="absolute left-10 top-[50px] flex">
          <Logo height={33.5} className="text-white" />
        </Link>
        <div className="absolute left-10 top-[323px] flex w-[420px] flex-col gap-[23px] text-white">
          <p className="text-5xl font-bold leading-[1.08]">
            Turn reflection into forward motion.
          </p>
          <p className="text-xl font-medium leading-[1.45]">
            Your AI life companion helps you find clarity, build meaningful
            journeys, and grow with intention.
          </p>
        </div>
      </aside>

      {/* The top edge sits where the Sign In form (~820px tall) is centred on
          screen, and stays there for every view, so switching to the taller
          Create an Account form doesn't move the tabs — it just extends down. */}
      <main className="flex min-w-0 flex-1 flex-col pb-10 md:gap-10 md:px-12 md:pt-[max(40px,calc((100dvh-820px)/2))] md:pb-12 xl:px-[152px]">
        {children ?? (
          <LoginForm
            initialView={view ?? "signin"}
            callbackUrl={callbackUrl ?? "/"}
error={error ?? null}
            twoFactorPending={twoFactorPending ?? false}
          />
        )}
      </main>
    </div>
  );
}
