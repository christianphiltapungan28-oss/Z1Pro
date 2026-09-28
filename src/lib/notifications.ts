import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  journeySteps,
  journeys,
  notifications,
  userSettings,
  type NotificationKind,
  type LifeMetricCategory,
  type NotificationPrefs,
} from "@/db/schema";
import { isMissingTable } from "@/lib/db-errors";
import { harmonyScore } from "@/lib/life-metrics";
import { LIFE_AREAS } from "@/lib/life-metrics-areas";

type NewNotification = {
  kind: NotificationKind;
  title: string;
  body: string;
  link?: { type: "journey" | "conversation" | "profile"; id?: string };
  /** A later notification with the same key replaces the earlier one. */
  dedupeKey?: string;
};

// Which Settings → Notifications toggle, if any, silences each kind. The
// email/push toggles are about delivery channels, which Z1P doesn't have yet.
const PREF_FOR_KIND: Partial<Record<NotificationKind, keyof NotificationPrefs>> = {
  step: "journeyMilestones",
  journey: "journeyMilestones",
  weekly: "weeklyReport",
};

async function prefs(userId: string): Promise<NotificationPrefs> {
  try {
    const [row] = await db
      .select({ prefs: userSettings.notificationPrefs })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);
    return row?.prefs ?? {};
  } catch (err) {
    if (isMissingTable(err)) return {};
    throw err;
  }
}

/**
 * Records an in-app notification. Never throws: a notification failing must
 * not fail the action that caused it, and the table may not exist yet
 * (scripts/add-notifications.sql).
 */
export async function notify(userId: string, n: NewNotification) {
  try {
    const pref = PREF_FOR_KIND[n.kind];
    // Toggles default to on (weekly report and milestones), as in Settings.
    if (pref && (await prefs(userId))[pref] === false) return;

    const values = {
      userId,
      kind: n.kind,
      title: n.title.slice(0, 120),
      body: n.body.slice(0, 400),
      linkType: n.link?.type ?? null,
      linkId: n.link?.id ?? null,
      dedupeKey: n.dedupeKey ?? null,
    };
    if (n.dedupeKey) {
      await db
        .insert(notifications)
        .values(values)
        .onConflictDoUpdate({
          target: [notifications.userId, notifications.dedupeKey],
          set: { title: values.title, body: values.body, readAt: null, createdAt: new Date() },
        });
    } else {
      await db.insert(notifications).values(values);
    }
  } catch (err) {
    if (!isMissingTable(err)) console.error("Couldn't record notification", err);
  }
}

/** ISO week, e.g. "2026-W40", used as the weekly report's dedupe key. */
function isoWeek(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/**
 * There is no scheduler, so the weekly progress report is written the first
 * time the user checks notifications in a new week, for the journey they
 * worked on most recently. At most one per week (dedupe key).
 */
export async function ensureWeeklyReport(userId: string) {
  const key = `weekly:${isoWeek(new Date())}`;
  const [existing] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.dedupeKey, key)))
    .limit(1);
  if (existing) return;
  if ((await prefs(userId)).weeklyReport === false) return;

  const [journey] = await db
    .select({ id: journeys.id, title: journeys.title, progress: journeys.progress })
    .from(journeys)
    .where(and(eq(journeys.userId, userId), isNull(journeys.completedAt)))
    .orderBy(desc(journeys.updatedAt))
    .limit(1);
  if (!journey) return;

  let stepLine = "";
  try {
    const [counts] = await db
      .select({
        total: sql<number>`count(*)::int`,
        done: sql<number>`count(*) filter (where ${journeySteps.status} = 'done')::int`,
      })
      .from(journeySteps)
      .where(eq(journeySteps.journeyId, journey.id));
    if (counts && counts.total > 0) {
      stepLine = ` You've finished ${counts.done} of ${counts.total} steps.`;
    }
  } catch (err) {
    if (!isMissingTable(err)) throw err;
  }

  await db
    .insert(notifications)
    .values({
      userId,
      kind: "weekly",
      title: "Weekly progress report",
      body: `Your “${journey.title}” journey is ${journey.progress}% complete.${stepLine} Keep the momentum going!`,
      linkType: "journey",
      linkId: journey.id,
      dedupeKey: key,
    })
    .onConflictDoNothing();
}

/** "Life Harmony updated" after new Life Metrics scores. */
export async function notifyLifeMetrics(userId: string, categories: LifeMetricCategory[]) {
  const harmony = harmonyScore(categories);
  if (harmony === null) return;
  const name = (key: string) => LIFE_AREAS.find((a) => a.key === key)?.name ?? key;
  const scored = categories
    .filter((c): c is LifeMetricCategory & { score: number } => c.score !== null)
    .sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 2).map((c) => `${name(c.key)} (${c.score})`);
  const low = scored.length > 2 ? scored[scored.length - 1] : null;
  const body = [
    top.length === 2 ? `${top[0]} and ${top[1]} are your strongest signals.` : null,
    low ? `${name(low.key)} needs attention this week.` : null,
  ]
    .filter(Boolean)
    .join(" ");
  await notify(userId, {
    kind: "metrics",
    title: `Life Harmony updated - ${harmony}%`,
    body: body || "Your Life Metrics scores have been worked out again.",
    link: { type: "profile" },
    dedupeKey: "metrics",
  });
}
