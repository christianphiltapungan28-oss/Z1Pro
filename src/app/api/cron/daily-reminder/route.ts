import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron";
import { isMissingTable } from "@/lib/db-errors";
import { sendDailyReminders } from "@/lib/notifications";

export const maxDuration = 300;

/**
 * Daily Conversation Reminders. Meant to be called once a day by a
 * scheduler (e.g. Vercel Cron, which sends "Authorization: Bearer
 * $CRON_SECRET"). Safe to call more than once a day.
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ sent: await sendDailyReminders() });
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: "Notifications aren't set up yet." }, { status: 503 });
    }
    throw err;
  }
}
