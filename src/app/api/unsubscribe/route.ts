import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { userSettings } from "@/db/schema";
import { validUnsubscribe } from "@/lib/unsubscribe";

async function unsubscribe(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("u") ?? "";
  const token = url.searchParams.get("t") ?? "";
  if (!validUnsubscribe(userId, token)) return false;
  // Turns off Settings → Notifications → Marketing & Tips.
  await db
    .update(userSettings)
    .set({
      notificationPrefs: sql`${userSettings.notificationPrefs} || '{"marketing": false}'::jsonb`,
      updatedAt: new Date(),
    })
    .where(eq(userSettings.userId, userId));
  return true;
}

function page(title: string, body: string, status = 200) {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#f6f7f9;color:#17171b">
<div style="max-width:440px;margin:80px auto;padding:28px;background:#fff;border:1px solid #e2e5ea;border-radius:16px">
<p style="font-size:22px;font-weight:800;color:#ff1da5;margin:0 0 16px">Z1P</p>
<h1 style="font-size:20px;margin:0 0 8px">${title}</h1><p style="color:#5f6368;line-height:1.5;margin:0">${body}</p>
</div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

/** The link in marketing emails. */
export async function GET(request: Request) {
  return (await unsubscribe(request))
    ? page("You're unsubscribed", "You won't get tips and product updates from Z1P any more. You can turn them back on in Settings → Notifications.")
    : page("That link doesn't work", "Turn off Marketing & Tips in Settings → Notifications instead.", 400);
}

/** One-click unsubscribe from the mail app (List-Unsubscribe-Post, RFC 8058). */
export async function POST(request: Request) {
  return (await unsubscribe(request))
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Invalid link" }, { status: 400 });
}
