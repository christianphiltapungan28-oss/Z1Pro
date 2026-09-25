import { NextResponse } from "next/server";
import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { journeyFiles, journeyMessages, journeySteps, journeys } from "@/db/schema";
import {
  adjustDailyCount,
  addDailyTokens,
  FAIR_USE_DAILY_MESSAGES,
  todayUtc,
} from "@/lib/chat-usage";
import { getCurrentOrg } from "@/lib/current-org";
import { coachingPrompt, splitStepMarker } from "@/lib/journey-flow";
import { getOwnedJourney } from "@/lib/journey-flow-data";
import { openaiFetch } from "@/lib/openai";
import { getCurrentPlanCode, getDailyMessageLimit, getModelForPlan } from "@/lib/plan";
import { rateLimit } from "@/lib/rate-limit";
import { isOverDailyBudget, recordUsage } from "@/lib/usage-guard";

const HISTORY_MESSAGES = 12;
const MAX_CONTENT = 4_000;

/**
 * One coaching turn. Counts against the same daily message limit as chat.
 * When the AI judges the current step finished, it marks it done and moves
 * the journey on.
 */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/journeys/[id]/coach">
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Shares chat's burst limit, so switching screens doesn't double it.
  const limit = await rateLimit(`messages:${userId}`, 20, 5 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many messages. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const { id } = await ctx.params;
  const journey = await getOwnedJourney(id, userId);
  if (!journey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!content || content.length > MAX_CONTENT) {
    return NextResponse.json(
      { error: `Write a reply (up to ${MAX_CONTENT} characters).` },
      { status: 400 }
    );
  }

  const steps = await db
    .select()
    .from(journeySteps)
    .where(eq(journeySteps.journeyId, id))
    .orderBy(asc(journeySteps.position));
  if (steps.length === 0) {
    return NextResponse.json(
      { error: "Upload a file or describe your task first, so I can plan the steps." },
      { status: 409 }
    );
  }
  const activeIndex = steps.findIndex((s) => s.status === "active");
  if (activeIndex === -1) {
    return NextResponse.json({ error: "This journey is already complete." }, { status: 409 });
  }

  if (!process.env.OPENAI_API_KEY || (await isOverDailyBudget("chatTokens"))) {
    return NextResponse.json(
      { error: "Zip is temporarily unavailable. Please try again later." },
      { status: 503 }
    );
  }

  const usageDate = todayUtc();
  const org = await getCurrentOrg();
  const planCode = org ? await getCurrentPlanCode(org.orgId) : "free";
  const planLimit = getDailyMessageLimit(planCode);
  const used = await adjustDailyCount(userId, usageDate, 1);
  if (used > (planLimit ?? FAIR_USE_DAILY_MESSAGES)) {
    await adjustDailyCount(userId, usageDate, -1);
    return NextResponse.json(
      { error: "Daily message limit reached", planCode, dailyLimit: planLimit },
      { status: 429 }
    );
  }

  const [userMessage] = await db
    .insert(journeyMessages)
    .values({ journeyId: id, userId, role: "user", content })
    .returning();

  const history = (
    await db
      .select({ role: journeyMessages.role, content: journeyMessages.content })
      .from(journeyMessages)
      .where(eq(journeyMessages.journeyId, id))
      .orderBy(desc(journeyMessages.createdAt))
      .limit(HISTORY_MESSAGES)
  ).reverse();

  const summaries = (
    await db
      .select({ name: journeyFiles.fileName, summary: journeyFiles.summary })
      .from(journeyFiles)
      .where(and(eq(journeyFiles.journeyId, id), isNotNull(journeyFiles.summary)))
      .orderBy(asc(journeyFiles.createdAt))
  ).map((f) => `From "${f.name}": ${f.summary}`);

  const model = getModelForPlan(planCode);
  let res: Response | null = null;
  try {
    res = await openaiFetch(
      "/chat/completions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          max_completion_tokens: 1_500,
          prompt_cache_key: `z1p-journey-${id}`,
          messages: [
            {
              role: "system",
              content: coachingPrompt({
                journeyTitle: journey.title,
                summaries,
                steps,
                activeIndex,
              }),
            },
            ...history.map((m) => ({ role: m.role, content: m.content })),
          ],
        }),
      },
      { timeoutMs: 90_000, maxRetries: 1 }
    );
  } catch (err) {
    console.error("Journey coaching request failed", err);
  }

  if (!res?.ok) {
    console.error("Journey coaching failed", res?.status, res ? await res.text().catch(() => "") : "");
    await adjustDailyCount(userId, usageDate, -1);
    return NextResponse.json(
      { error: "Zip couldn't reply just now. Please try again.", userMessage },
      { status: 502 }
    );
  }

  const data = await res.json();
  const usage = data.usage ?? {};
  const inputTokens: number = usage.prompt_tokens ?? 0;
  const outputTokens: number = usage.completion_tokens ?? 0;
  await recordUsage("chatTokens", inputTokens + outputTokens);
  await addDailyTokens(userId, usageDate, inputTokens, outputTokens);

  const raw = String(data.choices?.[0]?.message?.content ?? "").trim();
  const { text, completed } = splitStepMarker(raw);
  const reply = text || "Tell me a little more about that.";

  let completedStep: string | null = null;
  let journeyComplete = false;
  if (completed) {
    const current = steps[activeIndex];
    const next = steps[activeIndex + 1];
    completedStep = current.title;
    journeyComplete = !next;
    const doneCount = steps.filter((s) => s.status === "done").length + 1;
    await db.transaction(async (tx) => {
      await tx
        .update(journeySteps)
        .set({ status: "done", completedAt: new Date() })
        .where(eq(journeySteps.id, current.id));
      if (next) {
        await tx
          .update(journeySteps)
          .set({ status: "active" })
          .where(eq(journeySteps.id, next.id));
      }
      await tx
        .update(journeys)
        .set({
          progress: Math.round((doneCount / steps.length) * 100),
          completedAt: journeyComplete ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(journeys.id, id));
    });
  }

  const [assistantMessage] = await db
    .insert(journeyMessages)
    .values({ journeyId: id, userId, role: "assistant", content: reply })
    .returning();

  const updatedSteps = await db
    .select({
      id: journeySteps.id,
      position: journeySteps.position,
      title: journeySteps.title,
      tip: journeySteps.tip,
      status: journeySteps.status,
      completedAt: journeySteps.completedAt,
    })
    .from(journeySteps)
    .where(eq(journeySteps.journeyId, id))
    .orderBy(asc(journeySteps.position));
  const doneNow = updatedSteps.filter((s) => s.status === "done").length;

  return NextResponse.json({
    userMessage,
    assistantMessage,
    steps: updatedSteps,
    progress: Math.round((doneNow / updatedSteps.length) * 100),
    completedStep,
    journeyComplete,
  });
}
