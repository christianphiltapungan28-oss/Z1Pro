import { NextResponse } from "next/server";
import { and, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { aiConversations } from "@/db/schema";
import { rateLimit } from "@/lib/rate-limit";

const PAGE_SIZE = 7;
const MAX_QUERY_LENGTH = 100;

// Escape LIKE wildcards so a search for "50%" matches literally.
function likePattern(query: string) {
  return `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/**
 * One page of the user's conversations, newest activity first, with a
 * preview of the latest message and whether a journey was made from it.
 * `q` searches titles and message text.
 */
export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Math.min(1000, Number(params.get("page")) || 1));
  const query = (params.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);

  if (query) {
    // Searching scans message text, so keep it from being hammered.
    const limit = await rateLimit(`conversations:search:${userId}`, 60, 60_000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many searches. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }
  }

  // Subqueries name the outer table explicitly: Drizzle writes columns of a
  // single-table query unqualified ("id"), which inside a subquery would
  // silently bind to the subquery's own table instead.
  const outerId = sql.raw(`"ai_conversations"."id"`);

  const pattern = likePattern(query);
  const where = and(
    eq(aiConversations.userId, userId),
    isNull(aiConversations.archivedAt),
    query
      ? or(
          ilike(aiConversations.title, pattern),
          sql`exists (
            select 1 from ai_messages m
            where m.conversation_id = ${outerId} and m.content ilike ${pattern}
          )`
        )
      : undefined
  );

  const [{ total }] = await db
    .select({ total: count() })
    .from(aiConversations)
    .where(where);

  const items = await db
    .select({
      id: aiConversations.id,
      title: aiConversations.title,
      pinned: aiConversations.pinned,
      lastMessageAt: aiConversations.lastMessageAt,
      createdAt: aiConversations.createdAt,
      preview: sql<string | null>`(
        select left(m.content, 200) from ai_messages m
        where m.conversation_id = ${outerId}
        order by m.created_at desc limit 1
      )`,
      hasJourney: sql<boolean>`exists (
        select 1 from journeys j where j.source_conversation_id = ${outerId}
      )`,
    })
    .from(aiConversations)
    .where(where)
    .orderBy(
      desc(sql`coalesce(${aiConversations.lastMessageAt}, ${aiConversations.createdAt})`)
    )
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  return NextResponse.json({ items, total, page, pageSize: PAGE_SIZE });
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
      ? body.title.trim().slice(0, 200)
      : "New chat";

  const [conversation] = await db
    .insert(aiConversations)
    .values({ userId, title, lastMessageAt: new Date() })
    .returning();

  return NextResponse.json(conversation, { status: 201 });
}
