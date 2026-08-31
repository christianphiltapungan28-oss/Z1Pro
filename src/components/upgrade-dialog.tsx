"use client";

import { useEffect, useState } from "react";
import { CheckIcon, CloseIcon } from "@/components/icons";

type Plan = {
  code: string;
  name: string;
  description: string | null;
  priceMinorUnits: number | null;
  currency: string;
  billingInterval: string | null;
  features: string[];
};

function formatPrice(plan: Plan) {
  if (plan.priceMinorUnits === null) return null;
  if (plan.priceMinorUnits === 0) return "Free";
  const amount = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: plan.currency,
    minimumFractionDigits: plan.priceMinorUnits % 100 === 0 ? 0 : 2,
  }).format(plan.priceMinorUnits / 100);
  return plan.billingInterval ? `${amount}/${plan.billingInterval}` : amount;
}

export function UpgradeDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlanCode, setCurrentPlanCode] = useState("free");
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    let ignore = false;
    fetch("/api/plans")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (ignore || !data) return;
        setPlans(data.plans ?? []);
        setCurrentPlanCode(data.currentPlanCode ?? "free");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [open]);

  async function handleCheckout(plan: Plan) {
    setError(null);
    setCheckingOut(plan.code);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode: plan.code }),
      });
      if (!res.ok) {
        setError("Could not start checkout. Please try again.");
        return;
      }
      const data = await res.json();
      window.location.href = data.checkoutUrl;
    } finally {
      setCheckingOut(null);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close upgrade plans"
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
      />
      <div className="relative flex w-full max-w-4xl flex-col rounded-2xl border border-card-border bg-background p-6 shadow-xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-foreground">
            Upgrade your plan
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
        <p className="mb-6 text-sm text-muted">
          Pick the plan that fits how you use Z1P.pro.
        </p>

        {loading && (
          <p className="py-10 text-center text-sm text-muted">
            Loading plans…
          </p>
        )}

        {error && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
            {error}
          </p>
        )}

        {!loading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = plan.code === currentPlanCode;
              const isFreePlan = plan.priceMinorUnits === 0;
              const price = formatPrice(plan);
              const canCheckout =
                !isCurrent && !isFreePlan && price !== null;
              const label = isCurrent
                ? "Current plan"
                : price === null
                  ? "Coming soon"
                  : isFreePlan
                    ? "Free plan"
                    : checkingOut === plan.code
                      ? "Redirecting…"
                      : `Get ${plan.name}`;
              return (
                <div
                  key={plan.code}
                  className={`flex flex-col rounded-2xl border p-5 ${
                    isCurrent
                      ? "border-[#ff6791]"
                      : "border-card-border bg-card"
                  }`}
                >
                  <p className="font-display text-base font-semibold text-foreground">
                    {plan.name}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {price ?? "Coming soon"}
                  </p>
                  {plan.description && (
                    <p className="mt-1 text-xs text-muted">
                      {plan.description}
                    </p>
                  )}

                  {plan.features.length > 0 && (
                    <ul className="mt-4 flex flex-col gap-2">
                      {plan.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-2 text-sm text-foreground/80"
                        >
                          <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#ff6791]" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  )}

                  <button
                    type="button"
                    onClick={
                      canCheckout ? () => handleCheckout(plan) : undefined
                    }
                    disabled={!canCheckout || checkingOut !== null}
                    className={`mt-5 w-full rounded-full py-2.5 text-sm font-semibold transition-opacity ${
                      canCheckout
                        ? "bg-gradient-to-r from-[#ffc5d1] to-[#ff7892] text-white hover:opacity-90 disabled:opacity-60"
                        : "cursor-default bg-foreground/10 text-muted"
                    }`}
                  >
                    {label}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
