"use client";

import Image from "next/image";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { LEGAL } from "@/lib/legal";

type Tab = "signin" | "signup";

const COPY: Record<Tab, { title: string; description: string }> = {
  signin: {
    title: "Welcome back",
    description: "Continue your journeys and conversations with Zip.",
  },
  signup: {
    title: "Create your Zip account",
    description: "Start free. Build your first guided journey in minutes.",
  },
};

function FacebookIcon() {
  return (
    <svg aria-hidden="true" className="size-6" viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.07C24 5.68 18.63.4 12 .4S0 5.68 0 12.07c0 5.77 4.39 10.56 10.13 11.44v-8.1H7.08v-3.34h3.05V9.41c0-3.01 1.79-4.67 4.53-4.67 1.31 0 2.68.24 2.68.24v2.95h-1.51c-1.49 0-1.96.93-1.96 1.88v2.26h3.33l-.53 3.34h-2.8v8.1C19.61 22.63 24 17.84 24 12.07Z" />
    </svg>
  );
}

/**
 * Sign in / create an account, from the Figma auth screens. Sign-in is only
 * through Google or Facebook, so both tabs lead to the same buttons; the
 * consent box is required on both because either button can create a new
 * account.
 */
export function LoginForm({
  initialTab,
  callbackUrl,
  error,
}: {
  initialTab: Tab;
  callbackUrl: string;
  error: string | null;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [agreed, setAgreed] = useState(false);
  const [pending, setPending] = useState<"google" | "facebook" | null>(null);
  const copy = COPY[tab];

  function start(provider: "google" | "facebook") {
    if (!agreed || pending) return;
    setPending(provider);
    void signIn(provider, { redirectTo: callbackUrl });
  }

  const buttonClass =
    "flex h-[54px] w-full items-center justify-center gap-2.5 rounded-[10px] border border-field-border bg-background p-2.5 text-base font-medium text-subtle transition-colors hover:bg-foreground/[0.03] disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="flex w-full max-w-[636px] flex-col gap-10">
      <div role="tablist" aria-label="Sign in or create an account" className="relative w-[292px] pb-[5px]">
        <div className="flex items-center gap-8 text-xl">
          {(["signin", "signup"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={tab === t ? "font-medium text-foreground" : "text-subtle hover:text-foreground"}
            >
              {t === "signin" ? "Sign In" : "Create an Account"}
            </button>
          ))}
        </div>
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[5px] rounded-[10px] bg-field-border" />
        <span
          aria-hidden="true"
          className={`absolute bottom-0 h-[5px] rounded-[10px] bg-accent transition-all ${
            tab === "signin" ? "left-0 w-[21.53%]" : "left-[28.5%] w-[71.5%]"
          }`}
        />
      </div>

      <div className="flex w-full flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-[28px] font-bold text-foreground">{copy.title}</h1>
          <p className="text-base text-subtle">{copy.description}</p>
        </div>

        {error && (
          <p role="alert" className="rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

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
            , including my messages and voice recordings being processed by our
            AI provider (OpenAI) outside the Philippines. I am 18 or older, or
            I am 15 to 17 and my parent or guardian has also agreed to them.
          </span>
        </label>

        <div className="flex w-full flex-col gap-4">
          <button
            type="button"
            onClick={() => start("google")}
            disabled={!agreed || pending !== null}
            className={buttonClass}
          >
            <Image src="/ui/google-g.png" alt="" width={24} height={24} />
            {pending === "google"
              ? "Redirecting…"
              : tab === "signin"
                ? "Sign In With Google"
                : "Sign Up With Google"}
          </button>
          <button
            type="button"
            onClick={() => start("facebook")}
            disabled={!agreed || pending !== null}
            className={buttonClass}
          >
            <FacebookIcon />
            {pending === "facebook"
              ? "Redirecting…"
              : tab === "signin"
                ? "Sign In With Facebook"
                : "Sign Up With Facebook"}
          </button>
          {!agreed && (
            <p className="text-center text-xs text-faint">
              Tick the box above to continue.
            </p>
          )}
        </div>

        <p className="text-center text-sm text-subtle">
          {tab === "signin" ? (
            <>
              New to Zip?{" "}
              <button
                type="button"
                onClick={() => setTab("signup")}
                className="font-semibold text-foreground hover:underline"
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setTab("signin")}
                className="font-semibold text-accent hover:underline"
              >
                Log in
              </button>
            </>
          )}
        </p>
      </div>

      <p className="text-center text-xs text-faint">
        Need help? Contact{" "}
        <a href={`mailto:${LEGAL.contactEmail}`} className="underline">
          Zip support
        </a>
        .{" "}
        <Link href="/" className="underline">
          Continue as a guest
        </Link>
      </p>
    </div>
  );
}
