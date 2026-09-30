"use client";

import Image from "next/image";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { LEGAL } from "@/lib/legal";

export type AuthView = "signin" | "signup" | "forgot";

const COPY: Record<AuthView, { title: string; description: string; phoneTitle: string; phoneDescription: string }> = {
  signin: {
    title: "Welcome back",
    description: "Continue your journeys and conversations with Zip.",
    phoneTitle: "Welcome back",
    phoneDescription: "Continue your journeys and conversations with Zip.",
  },
  signup: {
    title: "Create your Zip account",
    description: "Start free. Build your first guided journey in minutes.",
    phoneTitle: "Create Your Account",
    phoneDescription: "Start Turning Your Journey Into a Forward Motion",
  },
  forgot: {
    title: "Forgot your password?",
    description:
      "Enter the email address connected to your Zip account. We’ll send you a secure reset link.",
    phoneTitle: "Forgot Your Password?",
    phoneDescription: "Enter your email address to recover or change your account password.",
  },
};

/** Phones: the pink brand header (mobile Figma 472:3547 / 484:3969 / 483:3729). */
function PhoneHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="flex flex-col gap-[31px] rounded-b-[50px] bg-accent px-[31px] pt-3 pb-[54px] text-white md:hidden">
      <Link href="/" aria-label="Z1P.pro home" className="flex self-start py-2">
        <Logo height={26} className="text-white" />
      </Link>
      <div className="flex flex-col">
        <h1 className="text-[28px] font-bold">{title}</h1>
        <p className="text-base leading-[1.35] font-medium">{description}</p>
      </div>
    </header>
  );
}

function FacebookIcon() {
  return (
    <svg aria-hidden="true" className="size-6" viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.07C24 5.68 18.63.4 12 .4S0 5.68 0 12.07c0 5.77 4.39 10.56 10.13 11.44v-8.1H7.08v-3.34h3.05V9.41c0-3.01 1.79-4.67 4.53-4.67 1.31 0 2.68.24 2.68.24v2.95h-1.51c-1.49 0-1.96.93-1.96 1.88v2.26h3.33l-.53 3.34h-2.8v8.1C19.61 22.63 24 17.84 24 12.07Z" />
    </svg>
  );
}

const OUTLINE_BUTTON =
  "flex h-[54px] w-full items-center justify-center gap-2.5 rounded-[10px] border border-field-border bg-background p-2.5 text-base font-medium text-subtle transition-colors hover:bg-foreground/[0.03] disabled:cursor-not-allowed disabled:opacity-50";

const INPUT =
  "h-[54px] w-full rounded-[10px] border border-field-border bg-background px-[19px] text-base text-foreground placeholder:text-subtle focus:border-accent focus:outline-none";

/** Labelled input as in the Figma "Input / …" components. */
function Field({
  label,
  className = "",
  ...input
}: { label: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`flex min-w-0 flex-col gap-[9px] ${className}`}>
      <span className="text-base text-foreground">{label}</span>
      <input {...input} className={INPUT} />
    </label>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-4" aria-hidden="true">
      <span className="h-px flex-1 bg-field-border" />
      <span className="text-sm text-subtle">or continue with</span>
      <span className="h-px flex-1 bg-field-border" />
    </div>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {children}
    </p>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="rounded-[10px] border border-field-border bg-surface px-4 py-3 text-sm text-foreground">
      {children}
    </p>
  );
}

/**
 * Second log-in step when two-factor is on: an authenticator code (or a
 * backup code) for the ticket the password step returned. Signs in on
 * success with a full page load.
 */
export function TwoFactorStep({
  ticket,
  redirectTo,
  onCancel,
}: {
  ticket: string;
  redirectTo: string;
  onCancel: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const failed = await post("/api/password/two-factor", { ticket, code });
    if (failed) {
      setError(failed);
      setBusy(false);
      return;
    }
    window.location.assign(redirectTo);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-foreground">Enter your code</h2>
        <p className="text-sm text-subtle">
          Open your authenticator app and enter the 6-digit code for Z1P. Lost your phone? Use one of your
          backup codes.
        </p>
      </div>
      <label className="flex flex-col gap-[9px]">
        <span className="text-base text-foreground">Code</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="one-time-code"
          inputMode="text"
          placeholder="123456"
          className={`${INPUT} tracking-widest`}
          autoFocus
          required
        />
      </label>
      {error && <Alert>{error}</Alert>}
      <button type="submit" disabled={busy || code.trim().length < 6} className={`${OUTLINE_BUTTON} text-foreground`}>
        {busy ? "Checking…" : "Verify and log in"}
      </button>
      <button type="button" onClick={onCancel} className="self-center text-sm font-semibold text-foreground hover:underline">
        ← Back to login
      </button>
    </form>
  );
}

async function post(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return res.ok ? null : ((data?.error as string | undefined) ?? "Something went wrong. Please try again.");
}

/**
 * Log in, create an account, or reset a password (Figma "Authentication —
 * Log In / Sign Up / Forgot Password"). Email + password accounts are
 * created only after the emailed link is clicked; Google and Facebook work
 * alongside. The consent box guards everything that can create an account.
 */
export function LoginForm({
  initialView,
  callbackUrl,
  error: initialError,
}: {
  initialView: AuthView;
  callbackUrl: string;
  error: string | null;
}) {
  const [view, setView] = useState<AuthView>(initialView);
  const [agreed, setAgreed] = useState(false);
  const [pending, setPending] = useState<"google" | "facebook" | "form" | null>(null);
  const [error, setError] = useState<string | null>(initialError);
  const [notice, setNotice] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  // Set when the password was right but two-factor is on.
  const [ticket, setTicket] = useState<string | null>(null);
  const copy = COPY[view];

  function go(next: AuthView) {
    setView(next);
    setError(null);
    setNotice(null);
    setPassword("");
    setConfirm("");
  }

  function social(provider: "google" | "facebook") {
    if (!agreed || pending) return;
    setPending(provider);
    void signIn(provider, { redirectTo: callbackUrl });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (view === "signup" && password !== confirm) {
      setError("The passwords don't match.");
      return;
    }
    setPending("form");
    try {
      if (view === "signin") {
        const res = await fetch("/api/password/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) return setError(data?.error ?? "Something went wrong. Please try again.");
        if (data?.twoFactor) {
          setTicket(data.ticket);
          setPassword("");
          return;
        }
        // A full load so the whole app picks up the new session.
        window.location.assign(callbackUrl);
        return;
      }
      if (view === "signup") {
        const failed = await post("/api/password/signup", { firstName, lastName, email, password, agreed });
        if (failed) return setError(failed);
        setNotice(`We sent a link to ${email.trim()}. Open it to finish creating your account.`);
        setPassword("");
        setConfirm("");
        return;
      }
      const failed = await post("/api/password/forgot", { email });
      if (failed) return setError(failed);
      setNotice(`If ${email.trim()} has a Zip account, a reset link is on its way. It expires in 1 hour.`);
    } finally {
      setPending((p) => (p === "form" ? null : p));
    }
  }

  const socialButtons = (
    <>
      <Divider />
      <button type="button" onClick={() => social("google")} disabled={!agreed || pending !== null} className={OUTLINE_BUTTON}>
        <Image src="/ui/google-g.png" alt="" width={24} height={24} />
        {pending === "google" ? "Redirecting…" : view === "signup" ? "Sign Up With Google" : "Sign In With Google"}
      </button>
      <button type="button" onClick={() => social("facebook")} disabled={!agreed || pending !== null} className={OUTLINE_BUTTON}>
        <FacebookIcon />
        {pending === "facebook" ? "Redirecting…" : view === "signup" ? "Sign Up With Facebook" : "Sign In With Facebook"}
      </button>
    </>
  );

  const consent = (
    <label className="flex items-start gap-3 text-sm text-subtle">
      <input
        type="checkbox"
        checked={agreed}
        onChange={(e) => setAgreed(e.target.checked)}
        className="mt-px size-5 shrink-0 rounded border border-field-border accent-[var(--accent-strong)]"
      />
      <span>
        I agree to the{" "}
        <Link href="/terms" target="_blank" className="font-semibold text-foreground underline">
          Terms of Use
        </Link>{" "}
        and{" "}
        <Link href="/privacy" target="_blank" className="font-semibold text-foreground underline">
          Privacy Policy
        </Link>
        , including my messages and voice recordings being processed by our AI provider (OpenAI) outside the
        Philippines. I am 18 or older, or I am 15 to 17 and my parent or guardian has also agreed to them.
      </span>
    </label>
  );

  const help = (
    <p className="px-[25px] text-center text-xs text-faint md:px-0">
      Need help? Contact{" "}
      <a href={`mailto:${LEGAL.contactEmail}`} className="underline">
        Zip support
      </a>
      .{" "}
      <Link href="/" className="underline">
        Continue as a guest
      </Link>
    </p>
  );

  if (ticket) {
    return (
      <div className="flex w-full flex-col gap-6 md:mx-auto md:max-w-[636px] md:gap-8 md:pt-[206px]">
        <PhoneHeader title="Two-factor login" description="One more step to keep your account safe." />
        <div className="mx-[31px] rounded-2xl border border-divider bg-background p-5 shadow-[0_8px_24px_rgba(17,24,39,0.06)] md:mx-0 md:p-10">
          <TwoFactorStep ticket={ticket} redirectTo={callbackUrl} onCancel={() => setTicket(null)} />
        </div>
      </div>
    );
  }

  if (view === "forgot") {
    return (
      // Desktop: the short card is centred within the Sign In form's area.
      <div className="flex w-full flex-col gap-6 md:mx-auto md:max-w-[636px] md:gap-8 md:pt-[206px]">
        <PhoneHeader title={copy.phoneTitle} description={copy.phoneDescription} />
        <div className="mx-[31px] flex flex-col gap-6 rounded-2xl border border-divider bg-background p-5 shadow-[0_8px_24px_rgba(17,24,39,0.06)] md:mx-0 md:p-10">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg text-accent md:text-[28px] md:font-bold md:text-foreground">
              <span className="md:hidden">Forgot Password?</span>
              <span className="hidden md:inline">{copy.title}</span>
            </h2>
            <p className="text-sm text-subtle md:text-base">{copy.description}</p>
          </div>
          {error && <Alert>{error}</Alert>}
          {notice && <Notice>{notice}</Notice>}
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field
              label="Email address"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={pending !== null}
              className="h-[54px] w-full rounded-[10px] bg-accent text-base font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 md:border md:border-field-border md:bg-background md:font-semibold md:text-foreground md:hover:bg-foreground/[0.03]"
            >
              {pending === "form" ? "Sending…" : "Send reset link"}
            </button>
          </form>
          <button type="button" onClick={() => go("signin")} className="self-center text-sm font-semibold text-foreground hover:underline">
            ← Back to login
          </button>
        </div>
        {help}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6 md:mx-auto md:max-w-[636px] md:gap-8">
      <PhoneHeader title={copy.phoneTitle} description={copy.phoneDescription} />
      <div role="tablist" aria-label="Sign in or create an account" className="relative hidden w-[292px] pb-[5px] md:block">
        <div className="flex items-center gap-8 text-xl">
          {(["signin", "signup"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={view === t}
              onClick={() => go(t)}
              className={view === t ? "font-medium text-foreground" : "text-subtle hover:text-foreground"}
            >
              {t === "signin" ? "Sign In" : "Create an Account"}
            </button>
          ))}
        </div>
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[5px] rounded-[10px] bg-field-border" />
        <span
          aria-hidden="true"
          className={`absolute bottom-0 h-[5px] rounded-[10px] bg-accent transition-all ${
            view === "signin" ? "left-0 w-[21.53%]" : "left-[28.5%] w-[71.5%]"
          }`}
        />
      </div>

      <div className="flex w-full flex-col gap-6 px-[25px] md:gap-5 md:px-0">
        <div className="hidden flex-col gap-2 md:flex">
          <h1 className="text-[28px] font-bold text-foreground">{copy.title}</h1>
          <p className="text-base text-subtle">{copy.description}</p>
        </div>

        {error && <Alert>{error}</Alert>}
        {notice && <Notice>{notice}</Notice>}

        <form onSubmit={submit} className="flex flex-col gap-3">
          {view === "signup" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-9">
              <Field
                label="First name"
                autoComplete="given-name"
                placeholder="Davy"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                maxLength={40}
                required
              />
              <Field
                label="Last name"
                autoComplete="family-name"
                placeholder="Mercado"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                maxLength={40}
              />
            </div>
          )}
          <Field
            label="Email address"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {view === "signin" ? (
            <>
              <Field
                label="Password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="button" onClick={() => go("forgot")} className="self-end text-base text-subtle hover:text-foreground">
                Forgot Password?
              </button>
            </>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-9">
              <Field
                label="Password"
                type="password"
                autoComplete="new-password"
                placeholder="8+ characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
              <Field
                label="Confirm password"
                type="password"
                autoComplete="new-password"
                placeholder="Repeat password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={8}
                required
              />
            </div>
          )}

          {view === "signup" && <div className="pt-3">{consent}</div>}

          <button
            type="submit"
            disabled={pending !== null || (view === "signup" && !agreed)}
            className={`${OUTLINE_BUTTON} mt-3 text-foreground`}
          >
            {pending === "form"
              ? view === "signin"
                ? "Logging in…"
                : "Creating…"
              : view === "signin"
                ? "Log in to Zip"
                : "Create account"}
          </button>
        </form>

        <div className="flex flex-col gap-3">
          {view === "signin" && consent}
          {socialButtons}
          {!agreed && (
            <p className="text-center text-xs text-faint">
              Tick the box {view === "signin" ? "above" : "above the Create account button"} to use Google or
              Facebook.
            </p>
          )}
        </div>

        <p className="text-center text-sm text-subtle">
          {view === "signin" ? (
            <>
              New to Zip?{" "}
              <button
                type="button"
                onClick={() => go("signup")}
                className="font-bold text-accent hover:underline md:font-semibold md:text-foreground"
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button type="button" onClick={() => go("signin")} className="font-semibold text-accent hover:underline">
                Log in
              </button>
            </>
          )}
        </p>
      </div>

      {help}
    </div>
  );
}
