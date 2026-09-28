"use client";

import { signOut, useSession } from "next-auth/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AssetIcon } from "@/components/asset-icon";
import { useDialog } from "@/lib/use-dialog";
import { useMediaQuery } from "@/lib/use-media-query";
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
    <div
      className={`w-full rounded-2xl border border-divider bg-background shadow-[0_2px_10px_rgba(32,33,36,0.06)] md:shadow-none ${className}`}
    >
      {children}
    </div>
  );
}

function RowText({ label, value, muted }: { label: string; value: React.ReactNode; muted?: boolean }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <p className="text-sm font-medium text-foreground md:text-[13px] md:font-bold">{label}</p>
      <div
        className={`text-xs leading-[1.35] md:text-[15px] md:leading-normal ${
          muted ? "text-tertiary" : "text-secondary md:text-label"
        }`}
      >
        {value}
      </div>
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
      className={`shrink-0 text-sm font-medium hover:underline md:font-semibold disabled:opacity-50 ${
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
  const [photoOpen, setPhotoOpen] = useState(false);
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
      <div className="flex items-center gap-6 border-b border-divider p-8">
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
        <ActionLink onClick={() => setPhotoOpen(true)}>Change photo</ActionLink>
      </div>
      {photoOpen && (
        <PhotoDialog
          name={p.name ?? p.email}
          image={p.image}
          onClose={() => setPhotoOpen(false)}
          onSaved={onSaved}
        />
      )}

      {!data.settingsReady && (
        <p className="border-b border-divider bg-surface px-8 py-3 text-sm text-label">
          Phone, timezone, about and country will be editable after the next
          update. Your name and language can be changed now.
        </p>
      )}

      {rows.map((row, index) => (
        <div key={row.field}>
          {index === 1 && (
            <div className="flex items-center justify-between gap-4 border-b border-divider min-h-[68px] px-4 py-3 md:min-h-0 md:px-8 md:py-5">
              <RowText label="Email" value={p.email} />
              <span className="shrink-0 text-[13px] text-tertiary">Managed by {provider}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-4 border-b border-divider min-h-[68px] px-4 py-3 md:min-h-0 md:px-8 md:py-5">
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

      <div className="flex items-center justify-between gap-4 min-h-[68px] px-4 py-3 md:min-h-0 md:px-8 md:py-5">
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
      <div className="flex flex-col gap-6 md:hidden">
        {NOTIFICATION_GROUPS.map((group) => (
          <div key={group.keys.join()} className="flex flex-col gap-2">
            {group.title && <SectionTitle>{group.title}</SectionTitle>}
            <Card>
              {group.keys.map((key, i) => {
                const row = NOTIFICATION_ROWS.find((r) => r.key === key)!;
                return (
                  <div
                    key={key}
                    className={`flex min-h-[68px] items-center justify-between gap-4 px-4 py-3 ${
                      i < group.keys.length - 1 ? "border-b border-divider" : ""
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
                );
              })}
            </Card>
          </div>
        ))}
      </div>
      <Card className="hidden md:block">
        {NOTIFICATION_ROWS.map((row, i) => (
          <div
            key={row.key}
            className={`flex items-center justify-between gap-4 min-h-[68px] px-4 py-3 md:min-h-0 md:px-8 md:py-5 ${
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

// Phones show the toggles in the mobile design's groups.
const NOTIFICATION_GROUPS: { title: string | null; keys: NotificationKey[] }[] = [
  { title: null, keys: ["email", "push"] },
  { title: null, keys: ["conversationReminders", "weeklyReport", "journeyMilestones"] },
  { title: "From Z1P", keys: ["marketing"] },
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium tracking-[0.6px] text-secondary uppercase md:hidden">
      {children}
    </p>
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
      <SectionTitle>Security</SectionTitle>
      <Card className="md:rounded-b-none md:border-b-0">
        <div className="flex items-center justify-between gap-4 border-b border-divider min-h-[68px] px-4 py-3 md:min-h-0 md:px-8 md:py-5">
          <RowText
            label="Two-Factor Authentication"
            value={`You sign in with ${provider}. Turn on 2-step verification in your ${provider} account to protect Z1P too.`}
          />
        </div>

        <div className="min-h-[68px] px-4 py-3 md:min-h-0 md:px-8 md:py-5 md:border-b md:border-divider">
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

      </Card>

      <SectionTitle>Your data</SectionTitle>
      <Card className="md:-mt-3 md:rounded-t-none md:border-t-0">
        <div className="flex items-center justify-between gap-4 border-b border-divider min-h-[68px] px-4 py-3 md:min-h-0 md:px-8 md:py-5">
          <RowText label="Download Your Data" value="Export all your conversations and journey data" />
          <ActionLink onClick={downloadData} disabled={busy}>
            Download
          </ActionLink>
        </div>

        <div className="flex items-center justify-between gap-4 min-h-[68px] px-4 py-3 md:min-h-0 md:px-8 md:py-5">
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
              className={`flex flex-col gap-3 rounded-2xl bg-background p-4 md:min-h-[299px] md:gap-5 md:p-6 ${
                isCurrent ? "border-2 border-accent" : "border border-divider"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2 md:flex-col md:items-start md:gap-1">
                <p className="text-base font-medium text-foreground md:text-xl md:font-bold">{plan.name}</p>
                <p
                  className={`text-xl font-medium md:text-[28px] md:font-extrabold ${
                    isCurrent ? "text-accent" : "text-foreground"
                  }`}
                >
                  {price}
                </p>
              </div>
              <ul className="flex flex-1 flex-col gap-1 md:gap-2">
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
                <span className="w-full rounded-[10px] bg-accent/15 px-4 py-2.5 text-center text-sm font-semibold text-accent md:border md:border-accent md:bg-background">
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

      <SectionTitle>Billing</SectionTitle>
      <Card className="-mt-4 overflow-hidden md:hidden">
        <div className="flex min-h-[68px] items-center gap-3 border-b border-divider px-4 py-3">
          <RowText label="Payment Method" value="Pay each period with GCash, Maya or card" />
        </div>
        <div className="flex min-h-[68px] items-center gap-3 px-4 py-3">
          <RowText
            label="Billing History"
            value={
              payments === null
                ? "Loading…"
                : succeeded.length === 0
                  ? "No billing history yet"
                  : `${succeeded.length} ${succeeded.length === 1 ? "payment" : "payments"}`
            }
          />
          {payments && payments.length > 0 && (
            <ActionLink onClick={() => setShowHistory((v) => !v)}>{showHistory ? "Hide" : "View"}</ActionLink>
          )}
        </div>
        {showHistory && payments && (
          <ul className="border-t border-divider">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs">
                <span className="text-foreground">
                  {new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  {" · "}
                  {p.plan ?? "—"}
                </span>
                <span className="text-secondary">
                  {formatMoney(p.amountMinorUnits, p.currency)} · <span className="capitalize">{p.status}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="hidden flex-col gap-6 p-8 md:flex">
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
// Dialogs (mobile Figma 653:10877 – 653:11294)

function SheetDialog({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useDialog<HTMLDivElement>(true, onClose);
  const titleId = useId();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex max-h-full w-full max-w-[350px] flex-col gap-5 overflow-y-auto rounded-[20px] bg-background p-[22px] shadow-[0_12px_28px_rgba(0,0,0,0.15)] outline-none"
      >
        <div className="flex flex-col gap-2">
          <h2 id={titleId} className="text-[22px] font-bold text-foreground">
            {title}
          </h2>
          {description && <div className="text-[13px] leading-[19px] text-secondary">{description}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

function DialogButtons({
  label,
  busy,
  disabled,
  onCancel,
}: {
  label: string;
  busy?: boolean;
  disabled?: boolean;
  onCancel?: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <button
        type="submit"
        disabled={disabled || busy}
        className="h-[46px] w-full rounded-[10px] bg-accent text-base font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Saving…" : label}
      </button>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="h-[46px] w-full rounded-[10px] border border-divider text-base font-medium text-foreground hover:bg-foreground/5"
        >
          Cancel
        </button>
      )}
    </div>
  );
}

const FIELD_INPUT =
  "h-[54px] w-full rounded-[10px] border border-accent bg-background px-[19px] text-base text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent/30";

async function patchSettings(body: Record<string, unknown>) {
  const res = await fetch("/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return null;
  const data = await res.json().catch(() => null);
  return (data?.error as string | undefined) ?? "Couldn't save that. Please try again.";
}

const FIELD_COPY: Record<
  Exclude<EditableField, "phone">,
  { title: string; description: string; label: string }
> = {
  name: { title: "Edit name", description: "Update the name shown on your Personal Profile.", label: "Name" },
  about: { title: "Edit about", description: "Share a little about yourself on your Personal Profile.", label: "About" },
  timezone: { title: "Timezone", description: "Used for reminders and your weekly report.", label: "Timezone" },
  locale: { title: "Language", description: "The language Z1P uses with you.", label: "Language" },
  country: { title: "Country", description: "Where you're based.", label: "Country" },
};

const ABOUT_MAX = 300;

function EditFieldDialog({
  field,
  initial,
  onClose,
  onSaved,
}: {
  field: Exclude<EditableField, "phone">;
  initial: string | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { update: updateSession } = useSession();
  const [draft, setDraft] = useState(
    initial ?? (field === "timezone" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "")
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = FIELD_COPY[field];
  const timezones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return ["Asia/Manila", "UTC"];
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const failed = await patchSettings({ [field]: draft });
    if (failed) {
      setError(failed);
      setSaving(false);
      return;
    }
    if (field === "name") await updateSession();
    await onSaved();
    onClose();
  }

  let control: React.ReactNode;
  if (field === "timezone" || field === "locale") {
    control = (
      <select value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={copy.label} className={FIELD_INPUT}>
        {field === "timezone"
          ? timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))
          : Object.entries(LANGUAGES).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
      </select>
    );
  } else if (field === "about") {
    control = (
      <div className="relative">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, ABOUT_MAX))}
          maxLength={ABOUT_MAX}
          rows={4}
          aria-label={copy.label}
          className="w-full resize-none rounded-[10px] border border-accent bg-background px-[13px] pt-3 pb-7 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <span className="pointer-events-none absolute right-3 bottom-3 text-xs text-secondary">
          {draft.length} / {ABOUT_MAX}
        </span>
      </div>
    );
  } else {
    control = (
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={field === "name" ? 80 : 60}
        aria-label={copy.label}
        className={FIELD_INPUT}
        autoFocus
      />
    );
  }

  return (
    <SheetDialog title={copy.title} description={copy.description} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-[9px]">
          <span className="text-base text-foreground">{copy.label}</span>
          {control}
        </label>
        {error && (
          <p role="alert" className="-mt-2 text-sm text-red-500">
            {error}
          </p>
        )}
        <DialogButtons label="Save changes" busy={saving} disabled={field === "name" && !draft.trim()} onCancel={onClose} />
      </form>
    </SheetDialog>
  );
}

/**
 * Phone number (mobile Figma 653:11168). Only the Philippines is offered, as
 * in the design. There is no SMS provider yet, so the number is saved
 * without a verification code.
 */
function PhoneDialog({
  current,
  onClose,
  onSaved,
}: {
  current: string | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [digits, setDigits] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = /^9\d{9}$/.test(digits);

  async function save(value: string | null) {
    setSaving(true);
    setError(null);
    const failed = await patchSettings({ phone: value });
    if (failed) {
      setError(failed);
      setSaving(false);
      return;
    }
    await onSaved();
    onClose();
  }

  return (
    <SheetDialog
      title={current ? "Edit mobile number" : "Add mobile number"}
      description={
        current ? (
          <>
            <span className="block">Current mobile number</span>
            <span className="block text-[15px] font-medium text-foreground">{current}</span>
          </>
        ) : (
          "Add a Philippine mobile number to your profile."
        )
      }
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) void save(`+63 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`);
        }}
        className="flex flex-col gap-5"
      >
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-[9px]">
            <span className="text-base text-foreground">
              Country code <span className="text-xs">(Current Available Country)</span>
            </span>
            <select className={FIELD_INPUT} value="+63" onChange={() => {}} aria-label="Country code">
              <option value="+63">+63 · Philippines</option>
            </select>
          </label>
          <label className="flex flex-col gap-[9px]">
            <span className="text-base text-foreground">Mobile number</span>
            <input
              value={digits}
              onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").replace(/^0/, "").slice(0, 10))}
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="912 345 6789"
              aria-label="Mobile number"
              className={FIELD_INPUT}
            />
          </label>
          {digits && !valid && (
            <p className="text-xs text-secondary">Enter the 10 digits after +63, starting with 9.</p>
          )}
        </div>
        {error && (
          <p role="alert" className="-mt-2 text-sm text-red-500">
            {error}
          </p>
        )}
        <DialogButtons label="Save number" busy={saving} disabled={!valid} onCancel={onClose} />
        {current && (
          <button
            type="button"
            onClick={() => save(null)}
            disabled={saving}
            className="-mt-2 self-center text-sm font-medium text-red-600 disabled:opacity-50"
          >
            Remove number
          </button>
        )}
      </form>
    </SheetDialog>
  );
}

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
const PHOTO_SIZE = 256;

/** Square-crops and shrinks a photo to a 256×256 JPEG data URL. */
async function resizePhoto(file: File) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = PHOTO_SIZE;
  canvas.height = PHOTO_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    PHOTO_SIZE,
    PHOTO_SIZE
  );
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

function PhotoDialog({
  name,
  image,
  onClose,
  onSaved,
}: {
  name: string;
  image: string | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { update: updateSession } = useSession();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!PHOTO_TYPES.includes(file.type)) {
      setError("Choose a JPG or PNG image.");
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      setError("That image is over 10 MB.");
      return;
    }
    try {
      setPreview(await resizePhoto(file));
    } catch {
      setError("That image couldn't be read. Try another one.");
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!preview) {
      input.current?.click();
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/settings/photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: preview }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Couldn't update your photo. Please try again.");
      setSaving(false);
      return;
    }
    await updateSession();
    await onSaved();
    onClose();
  }

  const shown = preview ?? image;

  return (
    <SheetDialog
      title="Update profile photo"
      description={`Choose a new image for ${name}’s Personal Profile. Use a square JPG or PNG for the best result.`}
      onClose={onClose}
    >
      <form onSubmit={save} className="flex flex-col items-center gap-5">
        <div className="flex flex-col items-center gap-2">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className="size-[88px] rounded-full object-cover" />
          ) : (
            <span className="flex size-[88px] items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-strong text-2xl font-semibold text-white">
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="flex flex-col items-center gap-1">
            <p className="text-base font-bold text-foreground">{name}</p>
            <p className="text-[13px] text-secondary">Personal Profile</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void choose(e.dataTransfer.files?.[0]);
          }}
          className={`flex h-36 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-accent ${
            dragging ? "bg-accent/15" : "bg-accent/[0.06]"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ui/upload.svg" alt="" width={25} height={25} />
          <span className="text-sm font-medium text-foreground">
            {preview ? "Choose a different image" : "Drop your image here"}
          </span>
          <span className="text-xs text-secondary">JPG or PNG · up to 10 MB</span>
        </button>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            void choose(file);
          }}
        />
        {error && (
          <p role="alert" className="-mt-2 self-stretch text-sm text-red-500">
            {error}
          </p>
        )}
        <div className="w-full">
          <DialogButtons label={preview ? "Save Changes" : "Update photo"} busy={saving} onCancel={onClose} />
        </div>
      </form>
    </SheetDialog>
  );
}

// ---------------------------------------------------------------------------
// Phones: list-style Settings with sub-screens (mobile Figma 552:5648 …)

type MobileScreen = "main" | "notifications" | "subscription" | "privacy";

const SCREEN_TITLES: Record<MobileScreen, string> = {
  main: "Settings",
  notifications: "Notifications",
  subscription: "Subscriptions",
  privacy: "Privacy & Security",
};

function MobileRow({
  label,
  detail,
  action,
  onClick,
  last,
  disabled,
}: {
  label: string;
  detail: React.ReactNode;
  action?: React.ReactNode;
  onClick?: () => void;
  last?: boolean;
  disabled?: boolean;
}) {
  const content = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="truncate text-xs leading-[1.35] font-medium text-secondary">{detail}</span>
      </span>
      {action && <span className="shrink-0 text-sm font-medium text-accent">{action}</span>}
    </>
  );
  const className = `flex min-h-[68px] w-full items-center gap-3 px-4 py-3 text-left ${
    last ? "" : "border-b border-divider"
  }`;
  return onClick ? (
    <button type="button" onClick={onClick} disabled={disabled} className={`${className} disabled:opacity-50`}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}

function MobileSettings({
  data,
  loadError,
  reload,
  onNotificationsChange,
  appearance,
  onOpenAppearance,
  onBack,
}: {
  data: SettingsData | null;
  loadError: boolean;
  reload: () => Promise<void>;
  onNotificationsChange: (next: SettingsData["notifications"]) => void;
  appearance: Appearance;
  onOpenAppearance: () => void;
  onBack: () => void;
}) {
  const [screen, setScreen] = useState<MobileScreen>("main");
  const [dialog, setDialog] = useState<EditableField | "photo" | null>(null);

  const p = data?.profile;
  const provider = data?.providers.includes("google")
    ? "Google"
    : data?.providers.includes("facebook")
      ? "Facebook"
      : "your sign-in provider";
  const locked = !data?.settingsReady;
  const name = p?.name ?? p?.email ?? "";

  return (
    <div className="h-full overflow-y-auto bg-background">
      <header className="flex h-[71px] items-center gap-3 border-b border-divider px-5">
        <button
          type="button"
          onClick={screen === "main" ? onBack : () => setScreen("main")}
          aria-label={screen === "main" ? "Back to profile" : "Back to settings"}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground/5"
        >
          <AssetIcon name="journey/arrow-left" width={18} height={18} />
        </button>
        <h1 className="truncate text-base font-bold text-foreground">{SCREEN_TITLES[screen]}</h1>
      </header>

      <div className={`flex flex-col gap-6 px-4 pb-8 ${screen === "main" ? "pt-[22px]" : "pt-3.5"}`}>
        {loadError && (
          <p role="alert" className="text-sm text-red-500">
            Couldn&rsquo;t load your settings. Please refresh and try again.
          </p>
        )}
        {!data && !loadError && screen !== "subscription" && (
          <p className="text-sm text-tertiary">Loading…</p>
        )}

        {data && p && screen === "main" && (
          <>
            <div className="flex items-center gap-4 px-2">
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image} alt="" className="size-[66px] shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex size-[66px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-strong text-xl font-semibold text-white">
                  {name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <p className="truncate text-xl font-bold text-foreground">{name}</p>
                <p className="text-sm text-secondary">Personal Profile</p>
              </div>
              <button type="button" onClick={() => setDialog("photo")} className="shrink-0 text-sm font-medium text-accent">
                Change
              </button>
            </div>

            {locked && (
              <p className="rounded-xl bg-surface px-4 py-3 text-xs text-label">
                Phone, timezone, about and country will be editable after the next update.
              </p>
            )}

            <div className="flex flex-col gap-2">
              <SectionTitle>Profile details</SectionTitle>
              <Card className="overflow-hidden">
                <MobileRow label="Name" detail={p.name ?? "N/A"} action="Edit" onClick={() => setDialog("name")} />
                <MobileRow label="Email" detail={p.email} action={<span className="text-xs text-tertiary">Managed by {provider}</span>} />
                <MobileRow label="Phone" detail={p.phone ?? "N/A"} action="Edit" onClick={() => setDialog("phone")} disabled={locked} />
                <MobileRow label="About" detail={p.about ?? "N/A"} action="Edit" onClick={() => setDialog("about")} disabled={locked} last />
              </Card>
            </div>

            <Card className="overflow-hidden">
              <MobileRow label="Notifications" detail="Manage your notification preferences" action="›" onClick={() => setScreen("notifications")} />
              <MobileRow label="Subscription" detail="Manage your plan and billing" action="›" onClick={() => setScreen("subscription")} />
              <MobileRow label="Privacy and Policy" detail="Review privacy, security, and policies" action="›" onClick={() => setScreen("privacy")} last />
            </Card>

            <div className="flex flex-col gap-2">
              <SectionTitle>Preferences</SectionTitle>
              <Card className="overflow-hidden">
                <MobileRow label="Timezone" detail={p.timezone ?? "Not set"} action="›" onClick={() => setDialog("timezone")} disabled={locked} />
                <MobileRow
                  label="Language"
                  detail={LANGUAGES[p.locale as keyof typeof LANGUAGES] ?? p.locale}
                  action="›"
                  onClick={() => setDialog("locale")}
                />
                <MobileRow label="Country" detail={p.country ?? "Not set"} action="›" onClick={() => setDialog("country")} disabled={locked} />
                <MobileRow
                  label="Appearance"
                  detail={appearance === "aurora" ? "Aurora" : "Daylight"}
                  action="›"
                  onClick={onOpenAppearance}
                  last
                />
              </Card>
            </div>

            <div className="flex flex-col gap-2">
              <SectionTitle>Account</SectionTitle>
              <Card className="overflow-hidden">
                <MobileRow label="Logout" detail="Sign out of your account" onClick={() => signOut({ redirectTo: "/" })} last />
              </Card>
            </div>
          </>
        )}

        {data && screen === "notifications" && (
          <NotificationsTab data={data} onChange={onNotificationsChange} />
        )}
        {data && screen === "privacy" && (
          <>
            <PrivacyTab data={data} />
            <div className="flex flex-col gap-2">
              <SectionTitle>Policies</SectionTitle>
              <Card className="overflow-hidden">
                {[
                  ["Privacy Policy", "/privacy"],
                  ["Terms and Conditions", "/terms"],
                  ["Cookie Policy", "/cookies"],
                  ["Refund Policy", "/refunds"],
                ].map(([label, href], i, all) => (
                  <a
                    key={href}
                    href={href}
                    className={`flex min-h-[52px] items-center justify-between px-4 py-3 text-sm font-medium text-foreground ${
                      i < all.length - 1 ? "border-b border-divider" : ""
                    }`}
                  >
                    {label}
                    <span className="text-accent">›</span>
                  </a>
                ))}
              </Card>
            </div>
          </>
        )}
        {screen === "subscription" && <SubscriptionTab />}
      </div>

      {data && p && dialog === "photo" && (
        <PhotoDialog name={name} image={p.image} onClose={() => setDialog(null)} onSaved={reload} />
      )}
      {data && p && dialog === "phone" && (
        <PhoneDialog current={p.phone} onClose={() => setDialog(null)} onSaved={reload} />
      )}
      {data && p && dialog && dialog !== "photo" && dialog !== "phone" && (
        <EditFieldDialog
          field={dialog}
          initial={dialog === "name" ? p.name : dialog === "locale" ? p.locale : p[dialog]}
          onClose={() => setDialog(null)}
          onSaved={reload}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function SettingsPage({
  appearance,
  onOpenAppearance,
  onBack,
}: {
  appearance: Appearance;
  onOpenAppearance: () => void;
  /** Phones: the back arrow returns to the Profile page. */
  onBack: () => void;
}) {
  const phone = useMediaQuery("(max-width: 767px)");
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

  if (phone) {
    return (
      <MobileSettings
        data={data}
        loadError={loadError}
        reload={load}
        onNotificationsChange={(notifications) => data && setData({ ...data, notifications })}
        appearance={appearance}
        onOpenAppearance={onOpenAppearance}
        onBack={onBack}
      />
    );
  }

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
