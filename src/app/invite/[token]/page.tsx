"use client";

import { useParams, useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { useEffect, useState } from "react";

type InviteDetails = {
  orgName: string;
  role: "admin" | "member";
  email: string | null;
  emailMatches: boolean;
  signedIn: boolean;
};

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { status } = useSession();

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    let ignore = false;
    fetch(`/api/invites/${token}`)
      .then(async (res) => {
        if (ignore) return;
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "This invite could not be found.");
          return;
        }
        setInvite(await res.json());
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [token]);

  async function handleAccept() {
    setAccepting(true);
    setError(null);
    try {
      const res = await fetch(`/api/invites/${token}/accept`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not accept this invite.");
        return;
      }
      router.push("/");
    } finally {
      setAccepting(false);
    }
  }

  const callbackUrl = typeof window !== "undefined" ? window.location.href : "/";

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-2xl border border-card-border bg-card p-6 text-center shadow-xl">
        {loading && <p className="py-10 text-sm text-muted">Loading invite…</p>}

        {!loading && error && (
          <>
            <h1 className="font-display text-lg font-semibold text-foreground">
              Invite unavailable
            </h1>
            <p className="mt-2 text-sm text-muted">{error}</p>
          </>
        )}

        {!loading && !error && invite && (
          <>
            <h1 className="font-display text-lg font-semibold text-foreground">
              Join {invite.orgName}
            </h1>
            <p className="mt-2 text-sm text-muted">
              You&rsquo;ve been invited as{" "}
              <span className="font-medium text-foreground">{invite.role}</span>.
            </p>

            {status !== "authenticated" ? (
              <div className="mt-6 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => signIn("google", { callbackUrl })}
                  className="rounded-full border border-card-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5"
                >
                  Continue with Google
                </button>
                <button
                  type="button"
                  onClick={() => signIn("facebook", { callbackUrl })}
                  className="rounded-full bg-[#1877F2] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                >
                  Continue with Facebook
                </button>
              </div>
            ) : !invite.emailMatches ? (
              <p className="mt-6 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
                This invite was sent to a different email address. Sign in
                with that account to join.
              </p>
            ) : (
              <button
                type="button"
                onClick={handleAccept}
                disabled={accepting}
                className="mt-6 w-full rounded-full bg-gradient-to-r from-accent to-accent-strong px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {accepting ? "Joining…" : `Join ${invite.orgName}`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
