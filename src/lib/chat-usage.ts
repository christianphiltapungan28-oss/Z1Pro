import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiUsageDaily } from "@/db/schema";

// "Unlimited" plans still get a fair-use ceiling so a leaked account or a
// runaway script can't run up an unbounded bill.
export const FAIR_USE_DAILY_MESSAGES = 300;

export function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Atomically adds `delta` to today's message count and returns the new
 * total. Chat and journey coaching both reserve a slot (+1) before calling
 * OpenAI and give it back (-1) if the call fails, so parallel requests can't
 * all slip past the daily limit.
 */
export async function adjustDailyCount(userId: string, usageDate: string, delta: number) {
  const [row] = await db
    .insert(aiUsageDaily)
    .values({ userId, usageDate, messageCount: Math.max(delta, 0) })
    .onConflictDoUpdate({
      target: [aiUsageDaily.userId, aiUsageDaily.usageDate],
      set: {
        messageCount: sql`greatest(${aiUsageDaily.messageCount} + ${delta}, 0)`,
      },
    })
    .returning({ messageCount: aiUsageDaily.messageCount });
  return row.messageCount;
}

/** Adds a reply's token counts to today's usage row. */
export async function addDailyTokens(
  userId: string,
  usageDate: string,
  inputTokens: number,
  outputTokens: number
) {
  await db
    .update(aiUsageDaily)
    .set({
      inputTokens: sql`${aiUsageDaily.inputTokens} + ${inputTokens}`,
      outputTokens: sql`${aiUsageDaily.outputTokens} + ${outputTokens}`,
    })
    .where(and(eq(aiUsageDaily.userId, userId), eq(aiUsageDaily.usageDate, usageDate)));
}
