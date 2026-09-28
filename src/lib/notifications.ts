import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  journeySteps,
  journeys,
  notifications,
  userSettings,
  users,
  type NotificationKind,
  type LifeMetricCategory,
  type NotificationPrefs,
} from "@/db/schema";
import { isMissingTable } from "@/lib/db-errors";
import { emailLink, sendEmail } from "@/lib/email";
import { harmonyScore } from "@/lib/life-metrics";
import { LIFE_AREAS } from "@/lib/life-metrics-areas";
import { sendPush } from "@/lib/push";

type NewNotification = {
  kind: NotificationKind;
  title: string;
  body: string;
  link?: { type: "journey" | "conversation" | "profile"; id?: string };
  /** A later notification with the same key replaces the earlier one. */
  dedupeKey?: string;
};

// Which Settings → Notifications toggle, if any, silences each kind.
const PREF_FOR_KIND: Partial<Record<NotificationKind, keyof NotificationPrefs>> = {
  step: "journeyMilestones",
  journey: "journeyMilestones",
  weekly: "weeklyReport",
};

// Off by default (as in Settings): these only go out when switched on.
const OPT_IN_KINDS: Partial<Record<NotificationKind, keyof NotificationPrefs>> = {
  reminder: "conversationReminders",
};

// Kinds also sent by email (when the Email toggle is on). Step and score
// updates stay in-app and push, so the inbox isn't flooded.
const EMAIL_KINDS = new Set<NotificationKind>(["journey", "weekly", "reply", "file"]);

/** Where tapping a push notification or email button goes. */
function linkPath(link: NewNotification["link"]) {
  if (link?.type === "journey" && link.id) return `/journeys/${link.id}`;
  if (link?.type === "profile") return "/?view=profile";
  if (link?.type === "conversation") return "/?view=conversations";
  return "/?view=notifications";
}

/** Push (Push toggle) and email (Email toggle), both on by default. */
async function deliver(userId: string, n: NewNotification, p: NotificationPrefs) {
  const url = linkPath(n.link);
  await Promise.all([
    p.push === false ? null : sendPush(userId, { title: n.title, body: n.body, url }),
    p.email === false || !EMAIL_KINDS.has(n.kind)
      ? null
      : db
          .select({ email: users.email })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1)
          .then(([u]) =>
            u?.email
              ? sendEmail({
                  to: u.email,
                  subject: n.title,
                  heading: n.title,
                  body: n.body,
                  button: { label: "Open Z1P", url: emailLink(url) },
                })
              : null
          ),
  ]);
}

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
    const p = await prefs(userId);
    const pref = PREF_FOR_KIND[n.kind];
    // Toggles default to on (weekly report and milestones), as in Settings.
    if (pref && p[pref] === false) return;
    const optIn = OPT_IN_KINDS[n.kind];
    if (optIn && p[optIn] !== true) return;

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
    await deliver(userId, n, p);
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
 * The weekly progress report, for the journey the user worked on most
 * recently. Written by the weekly job (/api/cron/weekly-report) and, as a
 * fallback when no scheduler runs, the first time the user checks
 * notifications in a new week. At most one per week (dedupe key); push and
 * email go out only when this call is the one that wrote it.
 */
export async function ensureWeeklyReport(userId: string) {
  const key = `weekly:${isoWeek(new Date())}`;
  const [existing] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.dedupeKey, key)))
    .limit(1);
  if (existing) return;
  const p = await prefs(userId);
  if (p.weeklyReport === false) return;

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

  const title = "Weekly progress report";
  const body = `Your “${journey.title}” journey is ${journey.progress}% complete.${stepLine} Keep the momentum going!`;
  const written = await db
    .insert(notifications)
    .values({
      userId,
      kind: "weekly",
      title,
      body,
      linkType: "journey",
      linkId: journey.id,
      dedupeKey: key,
    })
    .onConflictDoNothing()
    .returning({ id: notifications.id });
  if (written.length) {
    await deliver(userId, { kind: "weekly", title, body, link: { type: "journey", id: journey.id } }, p);
  }
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

const REMINDER_QUIET_HOURS = 20;

/**
 * Daily "Conversation Reminders" (Settings, off by default): for everyone
 * who switched them on and hasn't touched their latest unfinished journey
 * in the last 20 hours. Called by /api/cron/daily-reminder; at most one per
 * user per day (dedupe key). Returns how many were sent.
 */
export async function sendDailyReminders() {
  const optedIn = await db
    .select({ userId: userSettings.userId })
    .from(userSettings)
    .where(sql`(${userSettings.notificationPrefs} ->> 'conversationReminders') = 'true'`);

  const today = new Date().toISOString().slice(0, 10);
  const quietSince = new Date(Date.now() - REMINDER_QUIET_HOURS * 60 * 60_000);
  let sent = 0;
  for (const { userId } of optedIn) {
    const [journey] = await db
      .select({ id: journeys.id, title: journeys.title, updatedAt: journeys.updatedAt })
      .from(journeys)
      .where(and(eq(journeys.userId, userId), isNull(journeys.completedAt)))
      .orderBy(desc(journeys.updatedAt))
      .limit(1);
    if (!journey || journey.updatedAt > quietSince) continue;
    await notify(userId, {
      kind: "reminder",
      title: "Journey reminder from Zip",
      body: `You have a journey waiting. Tap to continue your “${journey.title}” journey.`,
      link: { type: "journey", id: journey.id },
      dedupeKey: `reminder:${today}`,
    });
    sent += 1;
  }
  return sent;
}
