import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { aiConversations } from "@/db/schema";

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
  const body = await request.json().catch(() => ({}));

  const updates: Partial<typeof aiConversations.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (typeof body.pinned === "boolean") updates.pinned = body.pinned;
  if (typeof body.title === "string" && body.title.trim())
    updates.title = body.title.trim();

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

  const [conversation] = await db
    .delete(aiConversations)
    .where(and(eq(aiConversations.id, id), eq(aiConversations.userId, userId)))
    .returning({ id: aiConversations.id });

  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
