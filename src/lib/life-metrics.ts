import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  aiConversations,
  aiMessages,
  journeys,
  type LifeMetricCategory,
} from "@/db/schema";
import { jsonCompletion } from "@/lib/ai-json";
import { LIFE_AREAS } from "@/lib/life-metrics-areas";

/** Scores are worked out again at most this often, and only after new activity. */
export const REFRESH_DAYS = 7;
/** Below this, there is too little to say anything useful. */
export const MIN_CONVERSATIONS = 3;

const MAX_CONVERSATIONS = 40;
const MAX_CHARS_PER_CONVERSATION = 600;
const MAX_JOURNEYS = 20;

export function harmonyScore(categories: LifeMetricCategory[]): number | null {
  const scored = categories.map((c) => c.score).filter((s): s is number => s !== null);
  if (scored.length < 2) return null;
  return Math.round(scored.reduce((a, b) => a + b, 0) / scored.length);
}

export function isStale(computedAt: Date | null, lastActivityAt: Date | null) {
  if (!computedAt) return true;
  const due = Date.now() - computedAt.getTime() >= REFRESH_DAYS * 24 * 60 * 60_000;
  return due && !!lastActivityAt && lastActivityAt > computedAt;
}

// ---------------------------------------------------------------------------
// Input: what the user said (never the assistant's replies) and their journeys.

async function gatherInput(userId: string) {
  const conversations = await db
    .select({ id: aiConversations.id, title: aiConversations.title })
    .from(aiConversations)
    .where(and(eq(aiConversations.userId, userId), isNull(aiConversations.archivedAt)))
    // Most recently active first; never-used chats last.
    .orderBy(sql`${aiConversations.lastMessageAt} desc nulls last`)
    .limit(MAX_CONVERSATIONS);

  const messages = conversations.length
    ? await db
        .select({ conversationId: aiMessages.conversationId, content: aiMessages.content })
        .from(aiMessages)
        .where(
          and(
            inArray(aiMessages.conversationId, conversations.map((c) => c.id)),
            eq(aiMessages.role, "user")
          )
        )
        .orderBy(asc(aiMessages.createdAt))
    : [];

  const said = new Map<string, string>();
  for (const m of messages) {
    const sofar = said.get(m.conversationId) ?? "";
    if (sofar.length >= MAX_CHARS_PER_CONVERSATION) continue;
    said.set(m.conversationId, `${sofar} ${m.content.replace(/\s+/g, " ")}`.trim());
  }
  const withText = conversations.filter((c) => said.has(c.id));

  const journeyRows = await db
    .select({ title: journeys.title, description: journeys.description, progress: journeys.progress })
    .from(journeys)
    .where(eq(journeys.userId, userId))
    .orderBy(desc(journeys.updatedAt))
    .limit(MAX_JOURNEYS);

  const lines = [
    "Conversations (the user's own words):",
    ...withText.map(
      (c, i) =>
        `C${i + 1}. ${c.title ? `[${c.title.slice(0, 80)}] ` : ""}${said
          .get(c.id)!
          .slice(0, MAX_CHARS_PER_CONVERSATION)}`
    ),
    "",
    "Journeys:",
    ...(journeyRows.length
      ? journeyRows.map(
          (j, i) =>
            `J${i + 1}. ${j.title.slice(0, 120)} — ${j.progress}% done${
              j.description ? ` — ${j.description.replace(/\s+/g, " ").slice(0, 200)}` : ""
            }`
        )
      : ["(none)"]),
  ];

  return { text: lines.join("\n"), conversationCount: withText.length };
}

// ---------------------------------------------------------------------------
// The AI call (cheapest model, once a week at most per user)

const PROMPT = `You are Z1, a warm AI life coach. From a user's own chat messages and journeys, estimate how well each life area is going for them right now. Be kind, specific and honest. Never diagnose medical or mental-health conditions, never judge beliefs or religion, and don't guess about areas the material doesn't mention. Write to the user as "you".

Areas:
${LIFE_AREAS.map((a) => `- ${a.key} ("${a.name}"): ${a.covers}`).join("\n")}

Reply with JSON only:
{"archetype": string (1-2 words, an encouraging label for their current stage, e.g. "Self-Actualizing", "Rebuilding", "Explorer"),
 "tagline": string (one line on how they are navigating life, max 90 characters),
 "summary": string (2-3 sentences, max 400 characters: the strongest areas, named exactly as in quotes above, what is progressing, and one gentle focus for this week),
 "areas": {${LIFE_AREAS.map((a) => `"${a.key}"`).join(", ")}: each {"score": integer 1-99 or null when the material says too little about it,
   "direction": "up" | "down" | "steady",
   "label": string (2 words describing the trend, e.g. "Trending Up", "Stable", "Needs Rest", "Low Focus"),
   "sources": array of the item ids (like "C3" or "J1") that touch this area,
   "note": string (1-2 sentences, max 160 characters, specific to what they shared)}}}
Use exactly those seven keys in "areas".`;

type RawArea = { score?: unknown; direction?: unknown; label?: unknown; sources?: unknown; note?: unknown };

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function normaliseArea(key: LifeMetricCategory["key"], raw: RawArea | undefined, conversationCount: number): LifeMetricCategory {
  const sources = Array.isArray(raw?.sources)
    ? raw!.sources.filter((s): s is string => typeof s === "string")
    : [];
  const chats = new Set(
    sources
      .map((s) => /^C(\d+)$/i.exec(s.trim())?.[1])
      .filter((n): n is string => !!n && Number(n) >= 1 && Number(n) <= conversationCount)
  ).size;
  const score =
    typeof raw?.score === "number" && Number.isFinite(raw.score) && sources.length > 0
      ? Math.max(1, Math.min(99, Math.round(raw.score)))
      : null;
  const direction =
    raw?.direction === "up" || raw?.direction === "down" ? raw.direction : "steady";
  return {
    key,
    score,
    direction: score === null ? "steady" : direction,
    label: score === null ? "Not enough yet" : clean(raw?.label, 24) || "Stable",
    chats,
    note:
      score === null
        ? "Talk with Z1 about this part of your life and a score will appear here."
        : clean(raw?.note, 200),
  };
}

export async function computeLifeMetrics(
  userId: string,
  previous: LifeMetricCategory[] | null
) {
  const input = await gatherInput(userId);
  if (input.conversationCount < MIN_CONVERSATIONS) return null;

  const before = previous?.filter((c) => c.score !== null);
  const content = before?.length
    ? `${input.text}\n\nLast week's scores: ${before.map((c) => `${c.key} ${c.score}`).join(", ")}`
    : input.text;

  const raw = await jsonCompletion(PROMPT, [{ type: "text", text: content }], 3000);
  // Accept areas keyed by name too ("Personal Growth"), which the model sometimes uses.
  const areas = new Map(
    Object.entries((raw.areas ?? {}) as Record<string, RawArea>).map(([k, v]) => [
      k.toLowerCase().replace(/[^a-z]/g, ""),
      v,
    ])
  );
  const categories = LIFE_AREAS.map((a) =>
    normaliseArea(
      a.key,
      areas.get(a.key) ?? areas.get(a.name.toLowerCase().replace(/[^a-z]/g, "")),
      input.conversationCount
    )
  );

  return {
    archetype: clean(raw.archetype, 30) || null,
    tagline: clean(raw.tagline, 120) || null,
    summary: clean(raw.summary, 500) || null,
    categories,
    conversationsAnalysed: input.conversationCount,
  };
}
