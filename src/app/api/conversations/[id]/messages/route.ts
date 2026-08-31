import { NextResponse } from "next/server";
import { and, asc, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { aiConversations, aiMessages, aiUsageDaily } from "@/db/schema";
import {
  getCurrentPlanCode,
  getDailyMessageLimit,
  getModelForPlan,
  getModelLabelForPlan,
} from "@/lib/plan";

function systemPrompt(modelLabel: string) {
  return `You are Z1P, a friendly and helpful AI assistant running on Z1P.pro. You are powered by the ${modelLabel} model. If asked what model, AI, or version you are, identify yourself as Z1P, powered by ${modelLabel} — do not say you are ChatGPT or name any other underlying model.

Format your answers for readability using Markdown when it helps:
- Use headings (##, ###) to break up longer answers into sections.
- Use bullet or numbered lists for steps, options, or multiple items.
- Use **bold** for key terms, and Markdown tables for tabular/comparison data.
- Use fenced code blocks with a language tag for code.

When a question is naturally about data or comparisons (trends, breakdowns, proportions, "compare X vs Y", statistics over time, etc.) and a chart would clarify the answer, include ONE fenced code block with the language "chart" containing ONLY valid JSON in this exact shape, in addition to your normal written explanation:

\`\`\`chart
{"type": "bar", "title": "Optional title", "labels": ["A", "B", "C"], "datasets": [{"label": "Series name", "data": [1, 2, 3]}]}
\`\`\`

"type" is "bar", "line", or "pie" — use "pie" only for a single dataset showing proportions of a whole. Only include a chart block when it genuinely helps; do not force one into every answer.`;
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

async function getOwnedConversation(id: string, userId: string) {
  const [conversation] = await db
    .select()
    .from(aiConversations)
    .where(and(eq(aiConversations.id, id), eq(aiConversations.userId, userId)))
    .limit(1);
  return conversation ?? null;
}

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/conversations/[id]/messages">
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const conversation = await getOwnedConversation(id, userId);
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const messages = await db
    .select()
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, id))
    .orderBy(asc(aiMessages.createdAt));

  return NextResponse.json({ messages });
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/conversations/[id]/messages">
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const conversation = await getOwnedConversation(id, userId);
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const content =
    typeof body?.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json(
      { error: "Message content is required" },
      { status: 400 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI is not configured" },
      { status: 500 }
    );
  }

  const usageDate = todayUtc();
  const planCode = await getCurrentPlanCode(userId);
  const dailyLimit = getDailyMessageLimit(planCode);
  const model = getModelForPlan(planCode);
  const modelLabel = getModelLabelForPlan(planCode);
  let priorMessageCount = 0;

  if (dailyLimit !== null) {
    const [usageRow] = await db
      .select({ messageCount: aiUsageDaily.messageCount })
      .from(aiUsageDaily)
      .where(
        and(
          eq(aiUsageDaily.userId, userId),
          eq(aiUsageDaily.usageDate, usageDate)
        )
      )
      .limit(1);
    priorMessageCount = usageRow?.messageCount ?? 0;

    if (priorMessageCount >= dailyLimit) {
      return NextResponse.json(
        {
          error: "Daily message limit reached",
          planCode,
          dailyLimit,
        },
        { status: 429 }
      );
    }
  }

  const [userMessage] = await db
    .insert(aiMessages)
    .values({ conversationId: id, role: "user", content })
    .returning();

  const history = await db
    .select({ role: aiMessages.role, content: aiMessages.content })
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, id))
    .orderBy(asc(aiMessages.createdAt));

  const completionRes = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt(modelLabel) },
          ...history.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    }
  );

  if (!completionRes.ok) {
    const errorText = await completionRes.text().catch(() => "");
    console.error("OpenAI request failed", completionRes.status, errorText);
    return NextResponse.json(
      { error: "AI request failed", userMessage },
      { status: 502 }
    );
  }

  const completion = await completionRes.json();
  const assistantContent: string =
    completion.choices?.[0]?.message?.content?.trim() || "…";
  const usage = completion.usage ?? {};

  const [assistantMessage] = await db
    .insert(aiMessages)
    .values({
      conversationId: id,
      role: "assistant",
      content: assistantContent,
      model,
      inputTokens: usage.prompt_tokens ?? null,
      outputTokens: usage.completion_tokens ?? null,
    })
    .returning();

  await db
    .insert(aiUsageDaily)
    .values({
      userId,
      usageDate,
      messageCount: 1,
      inputTokens: usage.prompt_tokens ?? 0,
      outputTokens: usage.completion_tokens ?? 0,
    })
    .onConflictDoUpdate({
      target: [aiUsageDaily.userId, aiUsageDaily.usageDate],
      set: {
        messageCount: sql`${aiUsageDaily.messageCount} + 1`,
        inputTokens: sql`${aiUsageDaily.inputTokens} + ${usage.prompt_tokens ?? 0}`,
        outputTokens: sql`${aiUsageDaily.outputTokens} + ${usage.completion_tokens ?? 0}`,
      },
    });

  await db
    .update(aiConversations)
    .set({
      lastMessageAt: new Date(),
      updatedAt: new Date(),
      ...(history.length === 1 && !conversation.title
        ? { title: content.slice(0, 60) }
        : {}),
    })
    .where(eq(aiConversations.id, id));

  return NextResponse.json({
    userMessage,
    assistantMessage,
    usage: {
      planCode,
      dailyLimit,
      messagesUsedToday: priorMessageCount + 1,
    },
  });
}
