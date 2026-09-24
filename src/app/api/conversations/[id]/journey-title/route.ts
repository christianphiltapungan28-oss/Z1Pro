import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { aiConversations, aiMessages } from "@/db/schema";
import { openaiFetch } from "@/lib/openai";
import { getModelForPlan } from "@/lib/plan";
import { rateLimit } from "@/lib/rate-limit";
import { isOverDailyBudget, recordUsage } from "@/lib/usage-guard";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Only the start of a conversation is needed to name its goal.
const MAX_MESSAGES = 8;
const MAX_CHARS = 4_000;

const PROMPT =
  "Name the goal of this conversation as a short journey title the user will work towards: 3 to 6 words, Title Case, starting with a verb where natural (e.g. \"Complete History 101 Assignment\"). Reply with the title only — no quotes or punctuation at the end.";

function fallbackTitle(firstUserMessage: string | undefined) {
  const text = (firstUserMessage ?? "New Journey").trim().replace(/\s+/g, " ");
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

/**
 * Suggests a journey title for converting a conversation. Uses the free
 * plan's (cheapest) model and a tiny output cap; falls back to the first
 * message if the AI is unavailable, so converting never depends on it.
 */
export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/conversations/[id]/journey-title">
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
    .select({ id: aiConversations.id })
    .from(aiConversations)
    .where(and(eq(aiConversations.id, id), eq(aiConversations.userId, userId)))
    .limit(1);
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const messages = await db
    .select({ role: aiMessages.role, content: aiMessages.content })
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, id))
    .orderBy(asc(aiMessages.createdAt))
    .limit(MAX_MESSAGES);
  const fallback = fallbackTitle(messages.find((m) => m.role === "user")?.content);

  const limit = await rateLimit(`journey-title:${userId}`, 10, 10 * 60_000);
  if (
    !limit.ok ||
    messages.length === 0 ||
    !process.env.OPENAI_API_KEY ||
    (await isOverDailyBudget("chatTokens"))
  ) {
    return NextResponse.json({ title: fallback, suggested: false });
  }

  let transcript = "";
  for (const m of messages) {
    const line = `${m.role === "user" ? "User" : "Assistant"}: ${m.content}\n`;
    if (transcript.length + line.length > MAX_CHARS) break;
    transcript += line;
  }

  try {
    const res = await openaiFetch(
      "/chat/completions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: getModelForPlan("free"),
          max_completion_tokens: 60,
          messages: [
            { role: "system", content: PROMPT },
            { role: "user", content: transcript || fallback },
          ],
        }),
      },
      { timeoutMs: 20_000, maxRetries: 0 }
    );
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);

    const data = await res.json();
    const usage = data.usage ?? {};
    await recordUsage(
      "chatTokens",
      (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0)
    );

    const title = String(data.choices?.[0]?.message?.content ?? "")
      .trim()
      .replace(/^["'“”]+|["'“”.]+$/g, "")
      .slice(0, 80);
    return NextResponse.json({ title: title || fallback, suggested: Boolean(title) });
  } catch (err) {
    console.error("Journey title suggestion failed", err);
    return NextResponse.json({ title: fallback, suggested: false });
  }
}
