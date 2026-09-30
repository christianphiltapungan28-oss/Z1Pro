"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useDialog } from "@/lib/use-dialog";

// The policies themselves (so the links in the modal can be read), and the
// pages used before or instead of being signed in.
const EXEMPT_PATHS = ["/terms", "/privacy", "/cookies", "/refunds", "/login", "/reset-password"];

const POLICIES = [
  { key: "terms", label: "Terms and Conditions", href: "/terms" },
  { key: "privacy", label: "Privacy Policy", href: "/privacy" },
  { key: "cookies", label: "Cookie Policy", href: "/cookies" },
] as const;

type PolicyKey = (typeof POLICIES)[number]["key"];

/**
 * After signing in, anyone who hasn't accepted the current Terms and
 * Conditions, Privacy Policy and Cookie Policy gets a modal asking them to,
 * before they can use the app. It asks again whenever the policies'
 * "Last updated" date changes.
 */
export function LegalGate() {
  const { status } = useSession();
  const pathname = usePathname();
  // The version to accept, while it still needs accepting.
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    let ignore = false;
    fetch("/api/legal")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { ready?: boolean; accepted?: boolean; version?: string } | null) => {
        if (!ignore && data?.ready && !data.accepted && data.version) setPending(data.version);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [status]);

  const exempt = EXEMPT_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (status !== "authenticated" || !pending || exempt) return null;
  return <LegalModal version={pending} onAccepted={() => setPending(null)} />;
}

function LegalModal({ version, onAccepted }: { version: string; onAccepted: () => void }) {
  const [checked, setChecked] = useState<Record<PolicyKey, boolean>>({
    terms: false,
    privacy: false,
    cookies: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Accepting is required, so Escape doesn't close it.
  const panelRef = useDialog(true, () => {});
  const allChecked = POLICIES.every((p) => checked[p.key]);

  async function accept() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/legal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version }),
      });
      if (res.ok) {
        onAccepted();
        return;
      }
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Couldn't save that. Please try again.");
    } catch {
      setError("Couldn't save that. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-title"
        aria-describedby="legal-intro"
        tabIndex={-1}
        className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col gap-5 overflow-y-auto rounded-2xl border border-card-border bg-background p-6 shadow-xl outline-none"
      >
        <div className="flex flex-col gap-2">
          <h2 id="legal-title" className="font-display text-xl font-semibold text-foreground">
            Before you continue
          </h2>
          <p id="legal-intro" className="text-sm leading-[22px] text-muted">
            Please read and accept our policies to use Z1P.pro. Each opens in a
            new tab. Last updated {version}.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {POLICIES.map((policy) => (
            <label
              key={policy.key}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-card-border p-3.5 text-sm leading-[22px] text-foreground has-[:checked]:border-accent/40 has-[:checked]:bg-accent/[0.04]"
            >
              <input
                type="checkbox"
                checked={checked[policy.key]}
                onChange={(e) => setChecked((prev) => ({ ...prev, [policy.key]: e.target.checked }))}
                className="mt-1 size-4 shrink-0 accent-accent"
              />
              <span>
                I have read and agree to the{" "}
                <Link
                  href={policy.href}
                  target="_blank"
                  rel="noopener"
                  className="font-semibold text-accent underline"
                >
                  {policy.label}
                </Link>
                .
              </span>
            </label>
          ))}
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-500">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={!allChecked || saving}
            onClick={accept}
            className="flex h-11 w-full items-center justify-center rounded-full bg-accent text-sm font-bold text-white transition-opacity disabled:opacity-40"
          >
            {saving ? "Saving…" : "Accept and continue"}
          </button>
          <button
            type="button"
            onClick={() => signOut({ redirectTo: "/" })}
            className="h-10 w-full text-sm font-semibold text-muted hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
