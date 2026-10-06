import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { isMissingTable } from "@/lib/db-errors";
import { pushConfigured } from "@/lib/push";
import { rateLimit } from "@/lib/rate-limit";

const MAX_DEVICES = 10;

function parseSubscription(body: unknown) {
  const sub = (body as { subscription?: unknown })?.subscription as
    { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | undefined;
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const authKey = sub?.keys?.auth;
  if (
    typeof endpoint !== "string" ||
    !endpoint.startsWith("https://") ||
    endpoint.length > 1000 ||
    typeof p256dh !== "string" ||
    p256dh.length > 200 ||
    typeof authKey !== "string" ||
    authKey.length > 100
  ) {
    return null;
  }
  return { endpoint, p256dh, auth: authKey };
}

/** POST { subscription } — this device allowed push notifications. */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!pushConfigured()) {
    return NextResponse.json({ error: "Push notifications aren't set up yet." }, { status: 503 });
  }
  const limit = await rateLimit(`push:subscribe:${userId}`, 20, 60 * 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const sub = parseSubscription(await request.json().catch(() => null));
  if (!sub) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  try {
    const existing = await db
      .select({ id: pushSubscriptions.id })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
    if (existing.length >= MAX_DEVICES) {
      return NextResponse.json(
        { error: `Push is already on for ${MAX_DEVICES} devices. Turn it off on one first.` },
        { status: 409 },
      );
    }
    // An endpoint belongs to one browser; if another account used it before,
    // it moves to this one.
    await db
      .insert(pushSubscriptions)
      .values({ userId, ...sub })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { userId, p256dh: sub.p256dh, auth: sub.auth },
      });
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: "Push notifications aren't set up yet." }, { status: 503 });
    }
    throw err;
  }
  return NextResponse.json({ ok: true });
}

/** DELETE { endpoint } — this device turned push off. */
export async function DELETE(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : null;
  if (!endpoint) {
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  }
  try {
    await db
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
  } catch (err) {
    if (!isMissingTable(err)) throw err;
  }
  return NextResponse.json({ ok: true });
}
