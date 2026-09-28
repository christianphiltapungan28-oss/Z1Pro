import { LoginForm, type AuthView } from "@/components/login-form";

/** The auth screen from the Figma file: brand panel plus the form. */
export function LoginScreen({
  view,
  callbackUrl,
  error,
  children,
}: {
  view?: AuthView;
  callbackUrl?: string;
  error?: string | null;
  /** Replaces the sign-in form (e.g. the reset-password page). */
  children?: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-dvh overflow-y-auto bg-background">
      <aside className="relative hidden w-[500px] shrink-0 overflow-hidden border-r border-field-border bg-accent lg:block">
        <div
          role="img"
          aria-label="Z1P"
          className="absolute left-10 top-[42px] grid place-items-start leading-none"
        >
          <span className="col-start-1 row-start-1 ml-[32.88px] font-logo text-[45px] font-extrabold leading-normal text-white">
            Z1P
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ui/logo-mark-white.svg"
            alt=""
            width={31.9209}
            height={31.9209}
            className="col-start-1 row-start-1 mt-[15.32px]"
          />
        </div>
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

      {/* Centred when it fits; top-aligned (and scrollable) when taller. */}
      <main className="flex min-w-0 flex-1 flex-col pb-10 md:justify-center-safe md:gap-10 md:px-12 md:pt-[72px] md:pb-12 xl:px-[152px]">
        {children ?? (
          <LoginForm initialView={view ?? "signin"} callbackUrl={callbackUrl ?? "/"} error={error ?? null} />
        )}
      </main>
    </div>
  );
}
