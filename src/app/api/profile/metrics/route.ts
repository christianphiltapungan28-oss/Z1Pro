import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { lifeMetrics } from "@/db/schema";
import { isMissingTable } from "@/lib/db-errors";
import { computeLifeMetrics } from "@/lib/life-metrics";
import { getLifeMetricsRow, loadProfile } from "@/lib/life-metrics-data";
import { rateLimit, redis } from "@/lib/rate-limit";
import { isOverDailyBudget } from "@/lib/usage-guard";

function notReady() {
  return NextResponse.json(
    { error: "Life Metrics isn't switched on for this app yet." },
    { status: 503 }
  );
}

/**
 * POST { action: "enable" } — the user turns Life Metrics on (their consent
 * to having health and faith inferred from their chats) and gets a first set
 * of scores. POST { action: "refresh" } — work the scores out again; the AI
 * only runs when they are a week old and there has been new activity.
 */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body?.action;
  if (action !== "enable" && action !== "refresh") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  let row;
  try {
    row = await getLifeMetricsRow(userId);
  } catch (err) {
    if (isMissingTable(err)) return notReady();
    throw err;
  }

  if (action === "enable" && !row) {
    await db.insert(lifeMetrics).values({ userId }).onConflictDoNothing();
  } else if (action === "refresh" && !row) {
    return NextResponse.json({ error: "Life Metrics is turned off." }, { status: 409 });
  }

  const current = await loadProfile(userId);
  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { metrics } = current;
  if (!metrics.eligible || !metrics.stale) {
    return NextResponse.json(current);
  }

  const limit = await rateLimit(`life-metrics:${userId}`, 5, 24 * 60 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { ...current, error: "Scores were updated recently. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }
  if (await isOverDailyBudget("chatTokens")) {
    return NextResponse.json(
      { ...current, error: "Z1 is very busy right now. Your scores will update later." },
      { status: 503 }
    );
  }

  // One computation at a time per user (two open tabs would otherwise both run it).
  const lockKey = `lock:life-metrics:${userId}`;
  const locked = await redis.set(lockKey, "1", { nx: true, ex: 180 });
  if (!locked) {
    return NextResponse.json({ ...current, busy: true }, { status: 202 });
  }

  try {
    const result = await computeLifeMetrics(userId, row?.categories ?? null);
    if (result) {
      // Written only if the user hasn't turned Life Metrics off meanwhile.
      await db
        .update(lifeMetrics)
        .set({ ...result, computedAt: new Date(), updatedAt: new Date() })
        .where(eq(lifeMetrics.userId, userId));
    }
  } catch (err) {
    console.error("Life Metrics computation failed", err);
    return NextResponse.json(
      { ...current, error: "Couldn't update your scores right now. Please try again later." },
      { status: 502 }
    );
  } finally {
    await redis.del(lockKey);
  }

  return NextResponse.json(await loadProfile(userId));
}

/** Turns Life Metrics off and deletes every score. */
export async function DELETE() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await db.delete(lifeMetrics).where(eq(lifeMetrics.userId, userId));
  } catch (err) {
    if (isMissingTable(err)) return notReady();
    throw err;
  }
  return NextResponse.json(await loadProfile(userId));
}
