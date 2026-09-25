import { NextResponse } from "next/server";
import { and, asc, count, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { aiConversations, aiMessages, journeySteps } from "@/db/schema";
import { planFromContent } from "@/lib/journey-flow";
import { getOwnedJourney, loadFlow, savePlan } from "@/lib/journey-flow-data";
import { rateLimit } from "@/lib/rate-limit";
import { isOverDailyBudget } from "@/lib/usage-guard";

const MAX_CONTEXT_CHARS = 8_000;

/**
 * Builds the step breakdown without a file: from the conversation the
 * journey was converted from, or from what the user types.
 */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/journeys/[id]/plan">
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await rateLimit(`journey-files:${userId}`, 10, 60 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts this hour. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const { id } = await ctx.params;
  const journey = await getOwnedJourney(id, userId);
  if (!journey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [{ steps }] = await db
    .select({ steps: count() })
    .from(journeySteps)
    .where(eq(journeySteps.journeyId, id));
  if (steps > 0) {
    return NextResponse.json({ error: "This journey already has its steps." }, { status: 409 });
  }

  if (!process.env.OPENAI_API_KEY || (await isOverDailyBudget("chatTokens"))) {
    return NextResponse.json(
      { error: "Planning is temporarily unavailable. Please try again later." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const description =
    typeof body?.description === "string" ? body.description.trim().slice(0, 2000) : "";

  let context = description;
  if (!context && journey.sourceConversationId) {
    const rows = await db
      .select({ role: aiMessages.role, content: aiMessages.content })
      .from(aiMessages)
      .innerJoin(aiConversations, eq(aiMessages.conversationId, aiConversations.id))
      .where(
        and(
          eq(aiMessages.conversationId, journey.sourceConversationId),
          eq(aiConversations.userId, userId)
        )
      )
      .orderBy(asc(aiMessages.createdAt))
      .limit(20);
    for (const m of rows) {
      const line = `${m.role === "user" ? "Student" : "Coach"}: ${m.content}\n`;
      if (context.length + line.length > MAX_CONTEXT_CHARS) break;
      context += line;
    }
  }
  if (!context) context = journey.description ?? "";
  if (!context.trim()) {
    return NextResponse.json(
      { error: "Tell me a bit about what you're working on first." },
      { status: 400 }
    );
  }

  try {
    const plan = await planFromContent(journey.title, [{ type: "text", text: context }]);
    if (!plan) {
      return NextResponse.json(
        { error: "I couldn't work out the steps from that. Add a little more detail?" },
        { status: 422 }
      );
    }
    await savePlan(id, userId, plan);
  } catch (err) {
    console.error("Journey planning failed", err);
    return NextResponse.json({ error: "Couldn't plan the steps. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ ready: true, ...(await loadFlow(id)) });
}
