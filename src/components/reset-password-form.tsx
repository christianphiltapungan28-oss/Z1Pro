"use client";

import Link from "next/link";
import { useState } from "react";

const INPUT =
  "h-[54px] w-full rounded-[10px] border border-field-border bg-background px-[19px] text-base text-foreground placeholder:text-subtle focus:border-accent focus:outline-none";

/**
 * Choose a new password from the emailed link. Styled like the Forgot
 * Password card (Figma 393:3260 / 483:3729), which has no reset screen of
 * its own.
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("The passwords don't match.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/password/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    if (res.ok) {
      // A full load (not router.push) so the whole app picks up the new session.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
      return;
    }
    const body = await res.json().catch(() => null);
    setError(body?.error ?? "Couldn't change your password. Please try again.");
    setSaving(false);
  }

  return (
    <div className="flex w-full flex-col gap-6 px-[25px] pt-10 md:mx-auto md:max-w-[636px] md:px-0 md:pt-[170px]">
      <div className="flex flex-col gap-6 rounded-2xl border border-divider bg-background p-5 shadow-[0_8px_24px_rgba(17,24,39,0.06)] md:p-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-foreground md:text-[28px]">Choose a new password</h1>
          <p className="text-sm text-subtle md:text-base">
            You&rsquo;ll be signed in here and signed out on your other devices.
          </p>
        </div>
        {!token ? (
          <p role="alert" className="rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            This link is missing its code. Open the link from the email again, or ask for a new one.
          </p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-[9px]">
              <span className="text-base text-foreground">New password</span>
              <input
                type="password"
                autoComplete="new-password"
                placeholder="8+ characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                className={INPUT}
              />
            </label>
            <label className="flex flex-col gap-[9px]">
              <span className="text-base text-foreground">Confirm password</span>
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Repeat password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={8}
                required
                className={INPUT}
              />
            </label>
            {error && (
              <p role="alert" className="rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={saving}
              className="mt-2 h-[54px] w-full rounded-[10px] bg-accent text-base font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save new password"}
            </button>
          </form>
        )}
        <Link href="/login?tab=forgot" className="self-center text-sm font-semibold text-foreground hover:underline">
          Ask for a new link
        </Link>
      </div>
    </div>
  );
}
