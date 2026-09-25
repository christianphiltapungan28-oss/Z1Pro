import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { journeyFiles, journeyMessages, journeySteps, journeys } from "@/db/schema";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getOwnedJourney(id: string, userId: string) {
  if (!UUID.test(id)) return null;
  const [journey] = await db
    .select()
    .from(journeys)
    .where(and(eq(journeys.id, id), eq(journeys.userId, userId)))
    .limit(1);
  return journey ?? null;
}

/** Everything the journey page shows, in one payload. */
export async function loadFlow(journeyId: string) {
  const [journey] = await db
    .select({
      id: journeys.id,
      title: journeys.title,
      description: journeys.description,
      progress: journeys.progress,
      completedAt: journeys.completedAt,
      createdAt: journeys.createdAt,
      sourceConversationId: journeys.sourceConversationId,
    })
    .from(journeys)
    .where(eq(journeys.id, journeyId))
    .limit(1);

  const steps = await db
    .select({
      id: journeySteps.id,
      position: journeySteps.position,
      title: journeySteps.title,
      tip: journeySteps.tip,
      status: journeySteps.status,
      completedAt: journeySteps.completedAt,
    })
    .from(journeySteps)
    .where(eq(journeySteps.journeyId, journeyId))
    .orderBy(asc(journeySteps.position));

  const files = await db
    .select({
      id: journeyFiles.id,
      fileName: journeyFiles.fileName,
      mimeType: journeyFiles.mimeType,
      sizeBytes: journeyFiles.sizeBytes,
      createdAt: journeyFiles.createdAt,
    })
    .from(journeyFiles)
    .where(eq(journeyFiles.journeyId, journeyId))
    .orderBy(asc(journeyFiles.createdAt));

  const recent = await db
    .select({
      id: journeyMessages.id,
      role: journeyMessages.role,
      content: journeyMessages.content,
      createdAt: journeyMessages.createdAt,
    })
    .from(journeyMessages)
    .where(eq(journeyMessages.journeyId, journeyId))
    .orderBy(desc(journeyMessages.createdAt))
    .limit(50);

  return { journey, steps, files, messages: recent.reverse() };
}

export type FlowPayload = Awaited<ReturnType<typeof loadFlow>>;

/** Saves a freshly planned breakdown: steps (first one active) + opener. */
export async function savePlan(
  journeyId: string,
  userId: string,
  plan: { steps: { title: string; tip: string }[]; firstMessage: string }
) {
  await db.transaction(async (tx) => {
    await tx.insert(journeySteps).values(
      plan.steps.map((s, i) => ({
        journeyId,
        position: i,
        title: s.title,
        tip: s.tip || null,
        status: i === 0 ? ("active" as const) : ("pending" as const),
      }))
    );
    await tx
      .insert(journeyMessages)
      .values({ journeyId, userId, role: "assistant", content: plan.firstMessage });
    await tx
      .update(journeys)
      .set({ progress: 0, completedAt: null, updatedAt: new Date() })
      .where(eq(journeys.id, journeyId));
  });
}

/**
 * Storage paths of uploaded originals, for cleanup when a journey or an
 * account is deleted. Empty if the flow tables don't exist yet.
 */
export async function storedFilePaths(where: { journeyId: string } | { userId: string }) {
  try {
    const rows = await db
      .select({ path: journeyFiles.storagePath })
      .from(journeyFiles)
      .where(
        "journeyId" in where
          ? eq(journeyFiles.journeyId, where.journeyId)
          : eq(journeyFiles.userId, where.userId)
      );
    return rows.map((r) => r.path).filter((p): p is string => Boolean(p));
  } catch {
    return [];
  }
}
