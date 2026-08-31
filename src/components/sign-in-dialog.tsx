"use client";

import { signIn } from "next-auth/react";
import { CloseIcon } from "@/components/icons";

export function SignInDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close sign in"
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-card-border bg-background p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-foreground">
            Sign in to Z1P.pro
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-foreground"
          >
            <CloseIcon className="h-4.5 w-4.5" />
          </button>
        </div>

        <p className="mb-5 text-sm text-muted">
          Sign in to save your history and upgrade to Ultra.
        </p>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => signIn("google")}
            className="flex items-center justify-center gap-2.5 rounded-full border border-card-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5"
          >
            <svg className="h-4.5 w-4.5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.6-.2-2.4H12v4.5h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.1-4 1.1-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1C3.4 21.3 7.4 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.4 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3V6.6H1.4C.5 8.3 0 10.1 0 12s.5 3.7 1.4 5.4l4-3.1Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.4 0 3.4 2.7 1.4 6.6l4 3.1c.9-2.8 3.5-4.9 6.6-4.9Z"
              />
            </svg>
            Continue with Google
          </button>

          <button
            type="button"
            onClick={() => signIn("facebook")}
            className="flex items-center justify-center gap-2.5 rounded-full bg-[#1877F2] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="white">
              <path d="M24 12.07C24 5.68 18.63.4 12 .4S0 5.68 0 12.07c0 5.77 4.39 10.56 10.13 11.44v-8.1H7.08v-3.34h3.05V9.41c0-3.01 1.79-4.67 4.53-4.67 1.31 0 2.68.24 2.68.24v2.95h-1.51c-1.49 0-1.96.93-1.96 1.88v2.26h3.33l-.53 3.34h-2.8v8.1C19.61 22.63 24 17.84 24 12.07Z" />
            </svg>
            Continue with Facebook
          </button>
        </div>
      </div>
    </div>
  );
}
