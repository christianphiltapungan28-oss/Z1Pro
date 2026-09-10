import { NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { aiConversations } from "@/db/schema";
import { rateLimit } from "@/lib/rate-limit";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversations = await db
    .select()
    .from(aiConversations)
    .where(
      and(eq(aiConversations.userId, userId), isNull(aiConversations.archivedAt))
    )
    .orderBy(
      desc(aiConversations.pinned),
      desc(aiConversations.lastMessageAt),
      desc(aiConversations.createdAt)
    );

  return NextResponse.json({
    pinned: conversations.filter((c) => c.pinned),
    recent: conversations.filter((c) => !c.pinned),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await rateLimit(`conversations:create:${userId}`, 20, 10 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many conversations created. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const body = await request.json().catch(() => ({}));
  const title =
    typeof body?.title === "string" && body.title.trim()
      ? body.title.trim()
      : "New chat";

  const [conversation] = await db
    .insert(aiConversations)
    .values({ userId, title, lastMessageAt: new Date() })
    .returning();

  return NextResponse.json(conversation, { status: 201 });
}
