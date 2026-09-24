import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { aiConversations, journeys } from "@/db/schema";
import { rateLimit } from "@/lib/rate-limit";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(journeys)
    .where(eq(journeys.userId, userId))
    .orderBy(desc(journeys.createdAt));

  return NextResponse.json({ journeys: rows });
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await rateLimit(`journeys:create:${userId}`, 20, 10 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many journeys created. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const body = await request.json().catch(() => ({}));
  const title =
    typeof body?.title === "string" ? body.title.trim().slice(0, 200) : "";
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const description =
    typeof body?.description === "string"
      ? body.description.trim().slice(0, 2000)
      : null;

  let sourceConversationId: string | null = null;
  if (typeof body?.sourceConversationId === "string") {
    const [owned] = await db
      .select({ id: aiConversations.id })
      .from(aiConversations)
      .where(
        and(
          eq(aiConversations.id, body.sourceConversationId),
          eq(aiConversations.userId, userId)
        )
      )
      .limit(1);
    sourceConversationId = owned?.id ?? null;
  }

  const [journey] = await db
    .insert(journeys)
    .values({ userId, title, description, sourceConversationId })
    .returning();

  return NextResponse.json(journey, { status: 201 });
}
