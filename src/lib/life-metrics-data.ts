import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiConversations, journeys, lifeMetrics, userSettings, users } from "@/db/schema";
import { isMissingTable } from "@/lib/db-errors";
import {
  harmonyScore,
  isStale,
  MIN_CONVERSATIONS,
  REFRESH_DAYS,
} from "@/lib/life-metrics";

async function optional<T>(query: Promise<T>, fallback: T) {
  try {
    return { ready: true, value: await query };
  } catch (err) {
    if (isMissingTable(err)) return { ready: false, value: fallback };
    throw err;
  }
}

async function activity(userId: string) {
  const [conversations] = await db
    .select({
      count: sql<number>`count(*)::int`,
      last: sql<string | null>`max(${aiConversations.lastMessageAt})`,
    })
    .from(aiConversations)
    .where(eq(aiConversations.userId, userId));
  const [journeyStats] = await db
    .select({
      count: sql<number>`count(*)::int`,
      last: sql<string | null>`max(${journeys.updatedAt})`,
    })
    .from(journeys)
    .where(eq(journeys.userId, userId));
  const times = [conversations?.last, journeyStats?.last]
    .filter((t): t is string => !!t)
    .map((t) => new Date(t));
  return {
    conversations: conversations?.count ?? 0,
    journeys: journeyStats?.count ?? 0,
    lastActivityAt: times.length ? new Date(Math.max(...times.map((t) => t.getTime()))) : null,
  };
}

export async function getLifeMetricsRow(userId: string) {
  const [row] = await db.select().from(lifeMetrics).where(eq(lifeMetrics.userId, userId)).limit(1);
  return row ?? null;
}

/** Everything the Profile page shows, in one payload. */
export async function loadProfile(userId: string) {
  const [user] = await db
    .select({ name: users.displayName, image: users.avatarUrl, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return null;

  const stats = await activity(userId);
  const settings = await optional(
    db
      .select({ about: userSettings.about })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1),
    []
  );
  const metrics = await optional(getLifeMetricsRow(userId), null);
  const row = metrics.value;

  return {
    profile: {
      name: user.name,
      image: user.image,
      about: settings.value[0]?.about ?? null,
      memberSince: user.createdAt,
      conversations: stats.conversations,
      journeys: stats.journeys,
    },
    metrics: {
      // False until scripts/add-life-metrics.sql has run.
      ready: metrics.ready,
      enabled: !!row,
      eligible: stats.conversations >= MIN_CONVERSATIONS,
      minConversations: MIN_CONVERSATIONS,
      refreshDays: REFRESH_DAYS,
      stale: row ? isStale(row.computedAt, stats.lastActivityAt) : false,
      computedAt: row?.computedAt ?? null,
      archetype: row?.archetype ?? null,
      tagline: row?.tagline ?? null,
      summary: row?.summary ?? null,
      harmony: row ? harmonyScore(row.categories) : null,
      categories: row?.categories ?? [],
      conversationsAnalysed: row?.conversationsAnalysed ?? 0,
    },
  };
}

export type ProfilePayload = NonNullable<Awaited<ReturnType<typeof loadProfile>>>;
