import { NextResponse } from "next/server";
import { and, count, desc, eq, isNull, lt } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { isMissingTable } from "@/lib/db-errors";
import { ensureWeeklyReport } from "@/lib/notifications";

const LIST_LIMIT = 50;
const KEEP_DAYS = 90;

/** The latest notifications plus the unread count (for the bell). */
export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const countOnly = new URL(request.url).searchParams.has("count");

  try {
    await ensureWeeklyReport(userId);
    const [{ unread }] = await db
      .select({ unread: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    if (countOnly) return NextResponse.json({ ready: true, unread });

    await db
      .delete(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          lt(notifications.createdAt, new Date(Date.now() - KEEP_DAYS * 86_400_000))
        )
      );
    const items = await db
      .select({
        id: notifications.id,
        kind: notifications.kind,
        title: notifications.title,
        body: notifications.body,
        linkType: notifications.linkType,
        linkId: notifications.linkId,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(LIST_LIMIT);
    return NextResponse.json({ ready: true, unread, items });
  } catch (err) {
    // The table comes from scripts/add-notifications.sql.
    if (isMissingTable(err)) return NextResponse.json({ ready: false, unread: 0, items: [] });
    throw err;
  }
}

/** Marks one notification ({ id }) or all of them ({ all: true }) as read. */
export async function PATCH(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : null;
  if (!id && body?.all !== true) {
    return NextResponse.json({ error: "Say which notification to mark." }, { status: 400 });
  }
  if (id && !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.userId, userId),
          isNull(notifications.readAt),
          ...(id ? [eq(notifications.id, id)] : [])
        )
      );
  } catch (err) {
    if (!isMissingTable(err)) throw err;
  }
  return NextResponse.json({ ok: true });
}
