import { NextResponse } from "next/server";
import { isNull } from "drizzle-orm";
import { db } from "@/db";
import { journeys } from "@/db/schema";
import { cronAuthorized } from "@/lib/cron";
import { isMissingTable } from "@/lib/db-errors";
import { ensureWeeklyReport } from "@/lib/notifications";

export const maxDuration = 300;

/**
 * Weekly progress reports for everyone with an unfinished journey. Meant to
 * be called once a week by a scheduler (e.g. Vercel Cron, which sends
 * "Authorization: Bearer $CRON_SECRET"). Safe to call more than once: each
 * user gets at most one report per week.
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .selectDistinct({ userId: journeys.userId })
    .from(journeys)
    .where(isNull(journeys.completedAt));

  let failed = 0;
  for (const { userId } of rows) {
    try {
      await ensureWeeklyReport(userId);
    } catch (err) {
      if (isMissingTable(err)) {
        return NextResponse.json({ error: "Notifications aren't set up yet." }, { status: 503 });
      }
      failed += 1;
      console.error("Weekly report failed", err);
    }
  }
  return NextResponse.json({ users: rows.length, failed });
}
