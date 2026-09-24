import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { aiConversations, journeys } from "@/db/schema";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The conversation's header details and the journey made from it, if any. */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/conversations/[id]">
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [conversation] = await db
    .select({
      id: aiConversations.id,
      title: aiConversations.title,
      pinned: aiConversations.pinned,
      createdAt: aiConversations.createdAt,
      lastMessageAt: aiConversations.lastMessageAt,
    })
    .from(aiConversations)
    .where(and(eq(aiConversations.id, id), eq(aiConversations.userId, userId)))
    .limit(1);
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [journey] = await db
    .select({ id: journeys.id, title: journeys.title })
    .from(journeys)
    .where(and(eq(journeys.sourceConversationId, id), eq(journeys.userId, userId)))
    .orderBy(desc(journeys.createdAt))
    .limit(1);

  return NextResponse.json({ ...conversation, journey: journey ?? null });
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/conversations/[id]">
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await request.json().catch(() => ({}));

  const updates: Partial<typeof aiConversations.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (typeof body.pinned === "boolean") updates.pinned = body.pinned;
  if (typeof body.title === "string" && body.title.trim())
    updates.title = body.title.trim().slice(0, 200);

  const [conversation] = await db
    .update(aiConversations)
    .set(updates)
    .where(and(eq(aiConversations.id, id), eq(aiConversations.userId, userId)))
    .returning();

  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(conversation);
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/conversations/[id]">
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [conversation] = await db
    .delete(aiConversations)
    .where(and(eq(aiConversations.id, id), eq(aiConversations.userId, userId)))
    .returning({ id: aiConversations.id });

  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
