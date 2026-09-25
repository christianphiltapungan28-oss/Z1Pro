import { LoginForm } from "@/components/login-form";

/** The auth screen from the Figma file: brand panel plus the sign-in form. */
export function LoginScreen({
  tab,
  callbackUrl,
  error,
}: {
  tab: "signin" | "signup";
  callbackUrl: string;
  error: string | null;
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

      <main className="flex min-w-0 flex-1 flex-col justify-center gap-10 px-6 pt-[72px] pb-12 sm:px-12 xl:px-[152px]">
        <LoginForm initialTab={tab} callbackUrl={callbackUrl} error={error} />
      </main>
    </div>
  );
}
