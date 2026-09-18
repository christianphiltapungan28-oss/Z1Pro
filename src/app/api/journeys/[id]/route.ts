import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { journeys } from "@/db/schema";

async function getOwnedJourney(id: string, userId: string) {
  const [journey] = await db
    .select()
    .from(journeys)
    .where(and(eq(journeys.id, id), eq(journeys.userId, userId)))
    .limit(1);
  return journey ?? null;
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/journeys/[id]">
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const journey = await getOwnedJourney(id, userId);
  if (!journey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const update: Partial<typeof journeys.$inferInsert> = { updatedAt: new Date() };

  if (typeof body?.title === "string" && body.title.trim()) {
    update.title = body.title.trim();
  }
  if (typeof body?.description === "string") {
    update.description = body.description.trim() || null;
  }
  if (typeof body?.progress === "number") {
    const progress = Math.max(0, Math.min(100, Math.round(body.progress)));
    update.progress = progress;
    update.completedAt = progress >= 100 ? new Date() : null;
  }

  const [updated] = await db
    .update(journeys)
    .set(update)
    .where(eq(journeys.id, id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/journeys/[id]">
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const journey = await getOwnedJourney(id, userId);
  if (!journey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.delete(journeys).where(eq(journeys.id, id));
  return NextResponse.json({ ok: true });
}
