"use client";

import { signOut, useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { useDialog } from "@/lib/use-dialog";
import { formatRelativeTime } from "@/lib/relative-time";
import { LANGUAGES } from "@/lib/settings";
import type { Appearance } from "@/lib/use-appearance";

type Tab = "account" | "notifications" | "privacy" | "subscription";

const TABS: { id: Tab; label: string }[] = [
  { id: "account", label: "Account" },
  { id: "notifications", label: "Notifications" },
  { id: "privacy", label: "Privacy & Security" },
  { id: "subscription", label: "Subscription" },
];

type NotificationKey =
  | "email"
  | "push"
  | "conversationReminders"
  | "weeklyReport"
  | "journeyMilestones"
  | "marketing";

type SettingsData = {
  settingsReady: boolean;
  providers: string[];
  profile: {
    name: string | null;
    email: string;
    image: string | null;
    locale: string;
    phone: string | null;
    timezone: string | null;
    about: string | null;
    country: string | null;
  };
  notifications: Record<NotificationKey, boolean>;
};

// ---------------------------------------------------------------------------
// Shared pieces

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`w-full rounded-2xl border border-divider bg-background ${className}`}>
      {children}
    </div>
  );
}

function RowText({ label, value, muted }: { label: string; value: React.ReactNode; muted?: boolean }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <p className="text-[13px] font-bold text-foreground">{label}</p>
      <div className={`text-[15px] ${muted ? "text-tertiary" : "text-label"}`}>{value}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        checked ? "bg-accent" : "bg-dot-inactive"
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-0.5 size-5 rounded-full bg-white transition-[left] ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

function ActionLink({
  children,
  onClick,
  danger,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`shrink-0 text-sm font-semibold hover:underline disabled:opacity-50 ${
        danger ? "text-red-600" : "text-accent"
      }`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Account

type EditableField = "name" | "phone" | "timezone" | "about" | "locale" | "country";

function AccountTab({
  data,
  onSaved,
  appearance,
  onOpenAppearance,
}: {
  data: SettingsData;
  onSaved: () => Promise<void>;
  appearance: Appearance;
  onOpenAppearance: () => void;
}) {
  const { update: updateSession } = useSession();
  const [editing, setEditing] = useState<EditableField | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timezones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return ["Asia/Manila", "UTC"];
    }
  }, []);

  const p = data.profile;
  const provider = data.providers.includes("google")
    ? "Google"
    : data.providers.includes("facebook")
      ? "Facebook"
      : "your sign-in provider";

  function startEdit(field: EditableField, current: string | null) {
    setError(null);
    setEditing(field);
    setDraft(current ?? (field === "timezone" ? Intl.DateTimeFormat().resolvedOptions().timeZone : ""));
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [editing]: draft }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Couldn't save that. Please try again.");
        return;
      }
      if (editing === "name") await updateSession();
      await onSaved();
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  const needsSettingsTable = (field: EditableField) =>
    !data.settingsReady && field !== "name" && field !== "locale";

  const rows: {
    field: EditableField;
    label: string;
    value: string | null;
    display?: string;
  }[] = [
    { field: "name", label: "Name", value: p.name },
    { field: "phone", label: "Phone", value: p.phone },
    { field: "timezone", label: "Timezone", value: p.timezone },
    { field: "about", label: "About", value: p.about },
    {
      field: "locale",
      label: "Language",
      value: p.locale,
      display: LANGUAGES[p.locale as keyof typeof LANGUAGES] ?? p.locale,
    },
    { field: "country", label: "Country", value: p.country },
  ];

  function editor(field: EditableField) {
    const common =
      "w-full max-w-md rounded-lg border-[1.5px] border-accent bg-background px-3 py-2 text-[15px] text-foreground focus:outline-none";
    if (field === "timezone") {
      return (
        <select value={draft} onChange={(e) => setDraft(e.target.value)} className={common} aria-label="Timezone">
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      );
    }
    if (field === "locale") {
      return (
        <select value={draft} onChange={(e) => setDraft(e.target.value)} className={common} aria-label="Language">
          {Object.entries(LANGUAGES).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      );
    }
    if (field === "about") {
      return (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={300}
          rows={3}
          aria-label="About"
          className={common}
        />
      );
    }
    return (
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={field === "phone" ? 30 : field === "name" ? 80 : 60}
        type={field === "phone" ? "tel" : "text"}
        aria-label={field === "phone" ? "Phone" : field === "name" ? "Name" : "Country"}
        className={common}
        autoFocus
      />
    );
  }

  return (
    <Card>
      <div className="border-b border-divider p-8">
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.image}
            alt=""
            className="h-[95px] w-[96px] rounded-full object-cover"
          />
        ) : (
          <div className="flex h-[95px] w-[96px] items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-strong text-2xl font-semibold text-white">
            {(p.name ?? p.email).slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>

      {!data.settingsReady && (
        <p className="border-b border-divider bg-surface px-8 py-3 text-sm text-label">
          Phone, timezone, about and country will be editable after the next
          update. Your name and language can be changed now.
        </p>
      )}

      {rows.map((row, index) => (
        <div key={row.field}>
          {index === 1 && (
            <div className="flex items-center justify-between gap-4 border-b border-divider px-8 py-5">
              <RowText label="Email" value={p.email} />
              <span className="shrink-0 text-[13px] text-tertiary">Managed by {provider}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-4 border-b border-divider px-8 py-5">
            {editing === row.field ? (
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <p className="text-[13px] font-bold text-foreground">{row.label}</p>
                {editor(row.field)}
                {error && (
                  <p role="alert" className="text-sm text-red-500">
                    {error}
                  </p>
                )}
              </div>
            ) : (
              <RowText
                label={row.label}
                value={row.display ?? row.value ?? "N/A"}
                muted={!row.value}
              />
            )}
            {editing === row.field ? (
              <div className="flex shrink-0 items-center gap-4">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="text-sm font-semibold text-label hover:underline"
                >
                  Cancel
                </button>
                <ActionLink onClick={save} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </ActionLink>
              </div>
            ) : (
              <ActionLink
                onClick={() => startEdit(row.field, row.value)}
                disabled={needsSettingsTable(row.field) || (editing !== null && editing !== row.field)}
              >
                Edit
              </ActionLink>
            )}
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between gap-4 px-8 py-5">
        <RowText label="Appearance" value={appearance === "aurora" ? "Aurora" : "Daylight"} />
        <ActionLink onClick={onOpenAppearance}>Edit</ActionLink>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Notifications

const NOTIFICATION_ROWS: { key: NotificationKey; label: string; description: string }[] = [
  { key: "email", label: "Email Notifications", description: "Receive updates and summaries via email" },
  { key: "push", label: "Push Notifications", description: "Get notified about new messages and reminders" },
  { key: "conversationReminders", label: "Conversation Reminders", description: "Daily reminder to continue your journeys" },
  { key: "weeklyReport", label: "Weekly Progress Report", description: "Get a weekly summary of your life metrics" },
  { key: "journeyMilestones", label: "Journey Milestones", description: "Be notified when you reach journey milestones" },
  { key: "marketing", label: "Marketing & Tips", description: "Receive tips and product updates" },
];

function NotificationsTab({
  data,
  onChange,
}: {
  data: SettingsData;
  onChange: (next: SettingsData["notifications"]) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  async function toggle(key: NotificationKey, value: boolean) {
    setError(null);
    const previous = data.notifications;
    onChange({ ...previous, [key]: value });
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notifications: { [key]: value } }),
    });
    if (!res.ok) {
      onChange(previous);
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Couldn't save that change. Please try again.");
    }
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <p className="text-sm text-tertiary">
        Your choices are saved now. Z1P doesn&rsquo;t send email or push
        notifications yet; these will apply as soon as it does.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}
      <Card>
        {NOTIFICATION_ROWS.map((row, i) => (
          <div
            key={row.key}
            className={`flex items-center justify-between gap-4 px-8 py-5 ${
              i < NOTIFICATION_ROWS.length - 1 ? "border-b border-divider" : ""
            }`}
          >
            <RowText label={row.label} value={row.description} />
            <Toggle
              label={row.label}
              checked={data.notifications[row.key]}
              disabled={!data.settingsReady}
              onChange={(next) => toggle(row.key, next)}
            />
          </div>
        ))}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Privacy & Security

type SessionRow = { id: string; createdAt: string; expiresAt: string; current: boolean };

function DeleteAccountDialog({ email, onClose }: { email: string; onClose: () => void }) {
  const panelRef = useDialog<HTMLFormElement>(true, onClose);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    setDeleting(true);
    setError(null);
    const res = await fetch("/api/settings/delete-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmEmail: typed }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Couldn't delete your account. Please try again.");
      setDeleting(false);
      return;
    }
    await signOut({ redirectTo: "/" });
  }

  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4">
      <form
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        tabIndex={-1}
        onSubmit={handleDelete}
        className="flex w-full max-w-[480px] flex-col gap-5 rounded-[20px] bg-background p-8 shadow-[0_12px_12px_rgba(0,0,0,0.16)] outline-none"
      >
        <h2 id="delete-account-title" className="text-[22px] font-bold text-foreground">
          Delete your account?
        </h2>
        <div className="flex flex-col gap-2 text-[15px] leading-[22px] text-label">
          <p>
            This permanently deletes your conversations, journeys, settings and
            sign-in, and signs you out everywhere. It can&rsquo;t be undone.
          </p>
          <p>
            Payment records are kept as required by Philippine tax law. You can
            download your data first from this page.
          </p>
        </div>
        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-label">
            Type <span className="text-foreground">{email}</span> to confirm
          </span>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className="w-full rounded-lg border-[1.5px] border-divider bg-background px-4 py-3 text-[15px] text-foreground focus:border-red-500 focus:outline-none"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-500">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border-[1.5px] border-divider px-6 py-3 text-sm font-semibold text-label hover:bg-foreground/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!matches || deleting}
            className="rounded-lg bg-red-600 px-6 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete account"}
          </button>
        </div>
      </form>
    </div>
  );
}

function PrivacyTab({ data }: { data: SettingsData }) {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [showSessions, setShowSessions] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function loadSessions() {
    const res = await fetch("/api/settings/sessions");
    if (res.ok) setSessions((await res.json()).sessions);
  }

  useEffect(() => {
    let ignore = false;
    fetch("/api/settings/sessions")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!ignore && body) setSessions(body.sessions);
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function signOutOthers() {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/settings/sessions", { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      const { revoked } = await res.json();
      setMessage(
        revoked > 0
          ? `Signed out of ${revoked} other ${revoked === 1 ? "device" : "devices"}.`
          : "No other devices were signed in."
      );
      await loadSessions();
    } else {
      setMessage("Couldn't sign out other devices. Please try again.");
    }
  }

  async function downloadData() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/export");
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setMessage(body?.error ?? "Couldn't prepare your data. Please try again.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `z1p-data-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  const provider = data.providers.includes("google")
    ? "Google"
    : data.providers.includes("facebook")
      ? "Facebook"
      : "your sign-in provider";
  const count = sessions?.length ?? 0;

  return (
    <div className="flex w-full flex-col gap-3">
      {message && (
        <p role="status" className="text-sm text-label">
          {message}
        </p>
      )}
      <Card>
        <div className="flex items-center justify-between gap-4 border-b border-divider px-8 py-5">
          <RowText
            label="Two-Factor Authentication"
            value={`You sign in with ${provider}. Turn on 2-step verification in your ${provider} account to protect Z1P too.`}
          />
        </div>

        <div className="border-b border-divider px-8 py-5">
          <div className="flex items-center justify-between gap-4">
            <RowText
              label="Active Sessions"
              value={
                sessions === null
                  ? "Loading…"
                  : `You have ${count} active ${count === 1 ? "session" : "sessions"}`
              }
            />
            <ActionLink onClick={() => setShowSessions((v) => !v)} disabled={sessions === null}>
              {showSessions ? "Hide" : "Manage"}
            </ActionLink>
          </div>
          {showSessions && sessions && (
            <div className="mt-4 flex flex-col gap-2">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg bg-surface px-4 py-3 text-sm"
                >
                  <span className="text-foreground">
                    Signed in {formatRelativeTime(s.createdAt)}
                    {s.current && (
                      <span className="ml-2 rounded-md bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
                        This device
                      </span>
                    )}
                  </span>
                  <span className="text-tertiary">
                    Expires {new Date(s.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              ))}
              {count > 1 && (
                <button
                  type="button"
                  onClick={signOutOthers}
                  disabled={busy}
                  className="self-start rounded-[10px] border border-divider px-4 py-2.5 text-sm font-semibold text-label hover:bg-foreground/5 disabled:opacity-50"
                >
                  Sign out all other devices
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 border-b border-divider px-8 py-5">
          <RowText label="Download Your Data" value="Export all your conversations and journey data" />
          <ActionLink onClick={downloadData} disabled={busy}>
            Download
          </ActionLink>
        </div>

        <div className="flex items-center justify-between gap-4 px-8 py-5">
          <RowText label="Delete Account" value="Permanently delete your account and all data" />
          <ActionLink danger onClick={() => setDeleting(true)}>
            Delete
          </ActionLink>
        </div>
      </Card>

      {deleting && (
        <DeleteAccountDialog email={data.profile.email} onClose={() => setDeleting(false)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subscription

type Plan = {
  code: string;
  name: string;
  description: string | null;
  priceMinorUnits: number | null;
  currency: string;
  billingInterval: string | null;
  features: string[];
};

type Payment = {
  id: string;
  plan: string | null;
  amountMinorUnits: number;
  currency: string;
  status: string;
  date: string;
};

function formatMoney(minor: number, currency: string) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
}

function SubscriptionTab() {
  const { data: session } = useSession();
  const canManageBilling = session?.user?.currentOrgRole !== "member";
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [currentPlanCode, setCurrentPlanCode] = useState("free");
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    fetch("/api/plans")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (ignore || !body) return;
        setPlans(body.plans ?? []);
        setCurrentPlanCode(body.currentPlanCode ?? "free");
      });
    fetch("/api/billing/history")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!ignore) setPayments(body?.payments ?? []);
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function checkout(plan: Plan) {
    setError(null);
    setCheckingOut(plan.code);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode: plan.code }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Could not start checkout. Please try again.");
        return;
      }
      const { checkoutUrl } = await res.json();
      window.location.href = checkoutUrl;
    } finally {
      setCheckingOut(null);
    }
  }

  const succeeded = payments?.filter((p) => p.status === "succeeded") ?? [];

  return (
    <div className="flex w-full flex-col gap-6">
      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}
      {!canManageBilling && (
        <p className="text-sm text-label">Only organization owners or admins can change the plan.</p>
      )}

      <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-3">
        {plans === null && <p className="text-sm text-tertiary">Loading plans…</p>}
        {plans?.map((plan) => {
          const isCurrent = plan.code === currentPlanCode;
          const price =
            plan.priceMinorUnits === null
              ? "Coming soon"
              : plan.priceMinorUnits === 0
                ? `${formatMoney(0, plan.currency)}/mo`
                : `${formatMoney(plan.priceMinorUnits, plan.currency)}/${plan.billingInterval === "year" ? "yr" : "mo"}`;
          const canBuy =
            !isCurrent && canManageBilling && plan.priceMinorUnits !== null && plan.priceMinorUnits > 0;
          return (
            <div
              key={plan.code}
              className={`flex min-h-[299px] flex-col gap-5 rounded-2xl bg-background p-6 ${
                isCurrent ? "border-2 border-accent" : "border border-divider"
              }`}
            >
              <div className="flex flex-col gap-1">
                <p className="text-xl font-bold text-foreground">{plan.name}</p>
                <p className={`text-[28px] font-extrabold ${isCurrent ? "text-accent" : "text-foreground"}`}>
                  {price}
                </p>
              </div>
              <ul className="flex flex-1 flex-col gap-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-[13px] text-label">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={isCurrent ? "/ui/check-accent.svg" : "/ui/check-muted.svg"}
                      alt=""
                      width={14}
                      height={14}
                      className="shrink-0"
                    />
                    {feature}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <span className="w-full rounded-[10px] border border-accent bg-background px-4 py-2.5 text-center text-sm font-semibold text-accent">
                  Current Plan
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => checkout(plan)}
                  disabled={!canBuy || checkingOut !== null}
                  className="w-full rounded-[10px] bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {checkingOut === plan.code ? "Redirecting…" : `Upgrade to ${plan.name.replace(/ plan$/i, "")}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-tertiary">
        Each payment covers one billing period and does not renew automatically.
      </p>

      <Card className="flex flex-col gap-6 p-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-base font-bold text-foreground">Payment Method</p>
            <p className="text-sm text-label">
              You pay for each period with GCash, Maya or card through PayMongo.
              Nothing is stored on file.
            </p>
          </div>
        </div>
        <div className="h-px w-full bg-divider" />
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-base font-bold text-foreground">Billing History</p>
              <p className="text-sm text-label">
                {payments === null
                  ? "Loading…"
                  : succeeded.length === 0
                    ? "No billing history yet"
                    : `${succeeded.length} ${succeeded.length === 1 ? "payment" : "payments"}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              disabled={!payments || payments.length === 0}
              className="shrink-0 rounded-[10px] border border-divider bg-background px-4 py-2.5 text-sm font-semibold text-label hover:bg-foreground/5 disabled:opacity-50"
            >
              {showHistory ? "Hide History" : "View History"}
            </button>
          </div>
          {showHistory && payments && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs font-bold text-label">
                  <tr className="border-b border-divider">
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Plan</th>
                    <th className="py-2 pr-4">Amount</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-divider last:border-0">
                      <td className="py-2 pr-4 text-foreground">
                        {new Date(p.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-2 pr-4 text-foreground">{p.plan ?? "—"}</td>
                      <td className="py-2 pr-4 text-foreground">{formatMoney(p.amountMinorUnits, p.currency)}</td>
                      <td className="py-2 capitalize text-label">{p.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function SettingsPage({
  appearance,
  onOpenAppearance,
}: {
  appearance: Appearance;
  onOpenAppearance: () => void;
}) {
  const [tab, setTab] = useState<Tab>("account");
  const [data, setData] = useState<SettingsData | null>(null);
  const [loadError, setLoadError] = useState(false);

  async function load() {
    const res = await fetch("/api/settings");
    if (!res.ok) {
      setLoadError(true);
      return;
    }
    setData(await res.json());
    setLoadError(false);
  }

  useEffect(() => {
    let ignore = false;
    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((body: SettingsData) => {
        if (!ignore) setData(body);
      })
      .catch(() => {
        if (!ignore) setLoadError(true);
      });
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="h-full overflow-y-auto bg-surface">
      <div className="flex flex-col gap-3.5 p-4 sm:p-10">
        <div role="tablist" aria-label="Settings" className="flex items-end overflow-x-auto border-b border-divider">
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className="flex shrink-0 flex-col items-start gap-2 pr-8 last:pr-0"
              >
                <span
                  className={`whitespace-nowrap text-[15px] ${
                    active ? "font-semibold text-accent" : "font-medium text-tertiary hover:text-label"
                  }`}
                >
                  {t.label}
                </span>
                <span className={`h-0.5 w-full rounded-sm ${active ? "bg-accent" : "bg-transparent"}`} />
              </button>
            );
          })}
        </div>

        <div className={tab === "subscription" ? "mt-2.5" : ""}>
          {loadError && tab !== "subscription" && (
            <p role="alert" className="text-sm text-red-500">
              Couldn&rsquo;t load your settings. Please refresh and try again.
            </p>
          )}
          {!data && !loadError && tab !== "subscription" && (
            <p className="text-sm text-tertiary">Loading…</p>
          )}
          {data && tab === "account" && (
            <AccountTab
              data={data}
              onSaved={load}
              appearance={appearance}
              onOpenAppearance={onOpenAppearance}
            />
          )}
          {data && tab === "notifications" && (
            <NotificationsTab
              data={data}
              onChange={(notifications) => setData({ ...data, notifications })}
            />
          )}
          {data && tab === "privacy" && <PrivacyTab data={data} />}
          {tab === "subscription" && <SubscriptionTab />}
        </div>
      </div>
    </div>
  );
}
