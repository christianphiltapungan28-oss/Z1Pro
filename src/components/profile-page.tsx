"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AssetIcon } from "@/components/asset-icon";
import { MenuIcon } from "@/components/icons";
import type { LifeMetricCategory } from "@/db/schema";
import { LIFE_AREAS } from "@/lib/life-metrics-areas";
import { formatRelativeTime } from "@/lib/relative-time";
import type { ProfilePayload } from "@/lib/life-metrics-data";

// ---------------------------------------------------------------------------
// Pieces

function Avatar({ image, name }: { image: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (image && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        onError={() => setFailed(true)}
        className="size-[97px] shrink-0 rounded-full object-cover"
      />
    );
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <div className="flex size-[97px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-strong text-3xl font-semibold text-white">
      {initials || "?"}
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[20px] border border-flow-line bg-background ${className}`}>
      {children}
    </div>
  );
}

const GAUGE_SIZE = 140;
const GAUGE_STROKE = 14;

function HarmonyGauge({ value }: { value: number | null }) {
  const radius = (GAUGE_SIZE - GAUGE_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = value === null ? 0 : (value / 100) * circumference;
  return (
    <div className="relative size-[140px] shrink-0">
      <svg
        width={GAUGE_SIZE}
        height={GAUGE_SIZE}
        viewBox={`0 0 ${GAUGE_SIZE} ${GAUGE_SIZE}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={GAUGE_SIZE / 2}
          cy={GAUGE_SIZE / 2}
          r={radius}
          fill="none"
          strokeWidth={GAUGE_STROKE}
          className="stroke-flow-line"
        />
        {filled > 0 && (
          <circle
            cx={GAUGE_SIZE / 2}
            cy={GAUGE_SIZE / 2}
            r={radius}
            fill="none"
            strokeWidth={GAUGE_STROKE}
            strokeDasharray={`${filled} ${circumference}`}
            className="stroke-accent transition-[stroke-dasharray] duration-700"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <p className="text-[32px] font-extrabold text-flow-ink">
          {value === null ? "—" : `${value}%`}
        </p>
        <p className="text-[11px] uppercase text-flow-muted">Harmony</p>
      </div>
    </div>
  );
}

/** Area names in the AI summary are picked out in pink, as in the design. */
function HighlightedSummary({ text }: { text: string }) {
  const names = LIFE_AREAS.map((a) => a.name).sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`(${names.join("|")})`, "g");
  return (
    <>
      {text.split(pattern).map((part, i) =>
        names.includes(part) ? (
          <span key={i} className="font-semibold text-accent">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function TrendBadge({ category }: { category: LifeMetricCategory }) {
  if (category.score === null) {
    return (
      <span className="shrink-0 rounded-md bg-flow-bg px-2 py-1 text-xs font-semibold text-flow-muted">
        {category.label}
      </span>
    );
  }
  const positive = category.direction !== "down";
  const arrow = category.direction === "up" ? "↑" : category.direction === "down" ? "↓" : "→";
  return (
    <span
      className={`shrink-0 whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold ${
        positive ? "bg-trend-up-bg text-success" : "bg-flow-bg text-flow-muted"
      }`}
    >
      {arrow} {category.label}
    </span>
  );
}

function MetricCard({ category }: { category: LifeMetricCategory }) {
  const area = LIFE_AREAS.find((a) => a.key === category.key)!;
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-flow-line bg-background p-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex shrink-0 rounded-[10px] bg-accent/8 p-2 text-accent">
            <AssetIcon name={area.icon} width={20} height={20} />
          </span>
          <p className="truncate text-base font-semibold text-flow-ink">{area.name}</p>
        </div>
        <TrendBadge category={category} />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2 whitespace-nowrap">
          <p className="font-bold text-flow-ink">
            <span className="text-[32px]">{category.score ?? "—"}</span>
            <span className="text-lg font-medium text-flow-muted">/99</span>
          </p>
          <p className="text-xs text-flow-faint">
            Based on {category.chats} {category.chats === 1 ? "chat" : "chats"}
          </p>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded bg-flow-line"
          role="progressbar"
          aria-label={`${area.name} score`}
          aria-valuemin={0}
          aria-valuemax={99}
          aria-valuenow={category.score ?? 0}
        >
          <div
            className="h-full rounded bg-accent transition-[width] duration-700"
            style={{ width: `${((category.score ?? 0) / 99) * 100}%` }}
          />
        </div>
      </div>
      <p className="text-[13px] leading-[18px] text-flow-muted">{category.note}</p>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <Card className="flex flex-col items-start gap-3 p-8 text-sm leading-[22px] text-flow-muted">
      {children}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Opt-in: health and faith are sensitive personal information, so nothing is
// worked out until the user explicitly agrees.

function EnableCard({ busy, onEnable }: { busy: boolean; onEnable: () => void }) {
  const [agreed, setAgreed] = useState(false);
  return (
    <Card className="flex flex-col gap-5 p-8">
      <div className="flex flex-col gap-2">
        <p className="text-lg font-bold text-flow-ink">Turn on Life Metrics</p>
        <p className="text-sm leading-[22px] text-flow-muted">
          Z1 can read what you&apos;ve shared in your conversations and journeys and
          give you a score for seven areas of your life — Purpose, Finances,
          Family, Health, Personal Growth, Faith and Community — plus an overall
          Life Harmony score.
        </p>
      </div>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-[22px] text-flow-muted">
        <li>Only your own messages and journeys are read, not Z1&apos;s replies.</li>
        <li>
          Health and Faith are sensitive topics. The scores are estimates to help
          you reflect, not a diagnosis or a judgement.
        </li>
        <li>
          Scores are worked out by our AI provider, OpenAI, and updated at most once
          a week.
        </li>
        <li>Only you can see them. You can turn this off at any time, which deletes every score.</li>
      </ul>
      <label className="flex cursor-pointer items-start gap-3 text-sm leading-[22px] text-flow-ink">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 size-4 shrink-0 accent-accent"
        />
        <span>
          I agree to Z1 analysing my conversations and journeys, including anything
          about my health and faith, to create these scores. See the{" "}
          <Link href="/privacy#life-metrics" className="font-semibold text-accent underline">
            Privacy Policy
          </Link>
          .
        </span>
      </label>
      <button
        type="button"
        disabled={!agreed || busy}
        onClick={onEnable}
        className="self-start rounded-[15px] bg-accent px-6 py-3 text-base font-medium text-white transition-opacity disabled:opacity-40"
      >
        {busy ? "Turning on…" : "Turn on Life Metrics"}
      </button>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page

function memberSince(iso: string | Date) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function ProfilePage({
  onMenuClick,
  onStartChat,
}: {
  onMenuClick: () => void;
  onStartChat: () => void;
}) {
  const [data, setData] = useState<ProfilePayload | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmOff, setConfirmOff] = useState(false);

  const runMetrics = useCallback(async (action: "enable" | "refresh") => {
    setUpdating(true);
    setMessage(null);
    try {
      const res = await fetch("/api/profile/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = await res.json().catch(() => null);
      if (body?.profile) setData(body);
      if (!res.ok && body?.error) setMessage(body.error);
    } catch {
      setMessage("Couldn't update your scores right now. Please try again later.");
    } finally {
      setUpdating(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((body: ProfilePayload) => {
        if (ignore) return;
        setData(body);
        // Weekly refresh happens when the page is opened; the server decides
        // whether it is actually due.
        const m = body.metrics;
        if (m.ready && m.enabled && m.eligible && m.stale) runMetrics("refresh");
      })
      .catch(() => {
        if (!ignore) setLoadError(true);
      });
    return () => {
      ignore = true;
    };
  }, [runMetrics]);

  async function enable() {
    setEnabling(true);
    await runMetrics("enable");
    setEnabling(false);
  }

  async function turnOff() {
    setConfirmOff(false);
    setMessage(null);
    const res = await fetch("/api/profile/metrics", { method: "DELETE" });
    const body = await res.json().catch(() => null);
    if (res.ok && body?.profile) {
      setData(body);
      setMessage("Life Metrics is off and your scores have been deleted.");
    } else {
      setMessage(body?.error ?? "Couldn't turn Life Metrics off. Please try again.");
    }
  }

  const profile = data?.profile;
  const metrics = data?.metrics;
  const name = profile?.name || "Your profile";
  const scored = !!metrics?.enabled && !!metrics.computedAt && metrics.categories.length > 0;
  const firstRun = !!metrics?.enabled && metrics.eligible && !metrics.computedAt;

  return (
    <div className="h-full overflow-y-auto bg-flow-bg">
      <div className="flex flex-col gap-8 px-4 py-6 sm:p-10">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="-mb-4 flex size-9 items-center justify-center rounded-full text-foreground/70 hover:text-foreground md:hidden"
        >
          <MenuIcon className="h-5 w-5" />
        </button>

        {loadError && <Notice>Couldn&apos;t load your profile. Please refresh the page.</Notice>}

        {!data && !loadError && (
          <div className="flex items-center gap-6" aria-busy="true">
            <div className="size-[97px] animate-pulse rounded-full bg-flow-line" />
            <div className="flex flex-col gap-3">
              <div className="h-7 w-56 animate-pulse rounded bg-flow-line" />
              <div className="h-4 w-80 max-w-full animate-pulse rounded bg-flow-line" />
            </div>
          </div>
        )}

        {profile && metrics && (
          <>
            <header className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
              <Avatar image={profile.image} name={name} />
              <div className="flex min-w-0 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-[28px] font-bold text-flow-ink">{name}</h1>
                  {metrics.enabled && metrics.archetype && (
                    <span className="rounded-full bg-accent/8 px-2.5 py-1 text-[11px] font-bold uppercase text-accent">
                      {metrics.archetype}
                    </span>
                  )}
                </div>
                <p className="max-w-[420px] text-[15px] text-flow-muted">
                  {profile.about ||
                    (metrics.enabled && metrics.tagline) ||
                    "Your life-coaching profile with Z1"}
                </p>
                <p className="text-xs text-flow-faint">
                  Member since {memberSince(profile.memberSince)} •{" "}
                  {profile.conversations}{" "}
                  {profile.conversations === 1 ? "Conversation" : "Conversations"} Guided
                </p>
              </div>
            </header>

            <div className="flex w-full items-center gap-3 rounded-xl border border-accent/13 bg-accent/3 p-[18px]">
              <AssetIcon name="profile/sparkles" width={20} height={20} className="text-accent" />
              <p className="flex-1 text-sm font-medium text-flow-ink">
                {updating
                  ? "Z1 is reading your conversations and journeys to update your scores…"
                  : "Insights based on your conversations & journeys with your AI life companion. These scores update weekly as your chat logs evolve."}
              </p>
            </div>

            {message && (
              <p role="status" className="-mt-4 text-sm text-flow-muted">
                {message}
              </p>
            )}

            {!metrics.ready ? (
              <Notice>
                <p className="font-bold text-flow-ink">Life Metrics isn&apos;t switched on yet</p>
                <p>This part of your profile will appear once it&apos;s ready.</p>
              </Notice>
            ) : !metrics.enabled ? (
              <EnableCard busy={enabling} onEnable={enable} />
            ) : !metrics.eligible && !scored ? (
              <Notice>
                <p className="font-bold text-flow-ink">Your scores are on their way</p>
                <p>
                  Have at least {metrics.minConversations} conversations with Z1 and your
                  first Life Metrics will appear here. You&apos;ve had{" "}
                  {profile.conversations} so far.
                </p>
                <button
                  type="button"
                  onClick={onStartChat}
                  className="rounded-[15px] bg-accent px-6 py-3 text-base font-medium text-white"
                >
                  Talk with Z1
                </button>
              </Notice>
            ) : firstRun && !scored ? (
              <Notice>
                <p className="font-bold text-flow-ink">
                  {updating ? "Working out your first scores…" : "Your first scores aren't ready yet"}
                </p>
                {!updating && (
                  <button
                    type="button"
                    onClick={() => runMetrics("refresh")}
                    className="rounded-[15px] bg-accent px-6 py-3 text-base font-medium text-white"
                  >
                    Try again
                  </button>
                )}
              </Notice>
            ) : (
              <>
                <Card className="flex flex-col items-center gap-8 p-8 sm:flex-row">
                  <HarmonyGauge value={metrics.harmony} />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <p className="text-lg font-bold text-flow-ink">Overall Life Harmony Summary</p>
                    <p className="text-sm leading-[22px] text-flow-muted">
                      {metrics.summary ? (
                        <HighlightedSummary text={metrics.summary} />
                      ) : (
                        "Keep talking with Z1 and your summary will fill in."
                      )}
                    </p>
                  </div>
                </Card>

                <section className="flex flex-col gap-6" aria-labelledby="categories-heading">
                  <h2 id="categories-heading" className="text-lg font-bold text-flow-ink">
                    Holistic Categories Breakdown
                  </h2>
                  <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
                    {metrics.categories.slice(0, 4).map((c) => (
                      <MetricCard key={c.key} category={c} />
                    ))}
                  </div>
                  <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                    {metrics.categories.slice(4).map((c) => (
                      <MetricCard key={c.key} category={c} />
                    ))}
                  </div>
                </section>
              </>
            )}

            {metrics.ready && metrics.enabled && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-flow-faint">
                {metrics.computedAt && (
                  <span>
                    Last updated {formatRelativeTime(String(metrics.computedAt))} from{" "}
                    {metrics.conversationsAnalysed} conversations • Updates every{" "}
                    {metrics.refreshDays} days
                  </span>
                )}
                {confirmOff ? (
                  <span className="flex items-center gap-3">
                    <span className="text-flow-muted">Delete all your scores?</span>
                    <button type="button" onClick={turnOff} className="font-semibold text-accent">
                      Yes, turn off
                    </button>
                    <button type="button" onClick={() => setConfirmOff(false)} className="font-semibold text-flow-muted">
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmOff(true)}
                    className="font-semibold text-flow-muted underline hover:text-flow-ink"
                  >
                    Turn off &amp; delete scores
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
