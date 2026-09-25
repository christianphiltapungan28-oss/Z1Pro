import { NextResponse } from "next/server";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  aiConversations,
  aiMessages,
  journeyFiles,
  journeyMessages,
  journeySteps,
  journeys,
  lifeMetrics,
  organizationMembers,
  organizations,
  payments,
  plans,
  users,
} from "@/db/schema";
import { isMissingTable } from "@/lib/db-errors";
import { rateLimit } from "@/lib/rate-limit";

/** Rows from a table added by a later SQL script, or [] if it isn't there yet. */
async function optionalRows<T>(query: Promise<T[]>): Promise<T[]> {
  try {
    return await query;
  } catch (err) {
    if (isMissingTable(err)) return [];
    throw err;
  }
}

/**
 * "Download Your Data": everything we hold about the user as one JSON file
 * (the data portability right in the Data Privacy Act).
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await rateLimit(`settings:export:${userId}`, 5, 60 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "You can download your data a few times an hour. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const [profile] = await db
    .select({
      name: users.displayName,
      email: users.email,
      avatarUrl: users.avatarUrl,
      locale: users.locale,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // user_settings may not exist yet on older databases.
  const settingsRows = await db
    .execute(
      sql`select phone, timezone, about, country, notification_prefs
          from user_settings where user_id = ${userId}
          and to_regclass('public.user_settings') is not null`
    )
    .catch(() => []);

  const conversations = await db
    .select({
      id: aiConversations.id,
      title: aiConversations.title,
      createdAt: aiConversations.createdAt,
    })
    .from(aiConversations)
    .where(eq(aiConversations.userId, userId))
    .orderBy(asc(aiConversations.createdAt));

  const messages = await db
    .select({
      conversationId: aiMessages.conversationId,
      role: aiMessages.role,
      content: aiMessages.content,
      createdAt: aiMessages.createdAt,
    })
    .from(aiMessages)
    .innerJoin(aiConversations, eq(aiMessages.conversationId, aiConversations.id))
    .where(eq(aiConversations.userId, userId))
    .orderBy(asc(aiMessages.createdAt));

  const byConversation = new Map<string, typeof messages>();
  for (const m of messages) {
    const list = byConversation.get(m.conversationId) ?? [];
    list.push(m);
    byConversation.set(m.conversationId, list);
  }

  const journeyRows = await db
    .select({
      id: journeys.id,
      title: journeys.title,
      description: journeys.description,
      progress: journeys.progress,
      completedAt: journeys.completedAt,
      createdAt: journeys.createdAt,
    })
    .from(journeys)
    .where(eq(journeys.userId, userId));
  const journeyIds = journeyRows.map((j) => j.id);

  const stepRows = journeyIds.length
    ? await optionalRows(
        db
          .select({
            journeyId: journeySteps.journeyId,
            title: journeySteps.title,
            tip: journeySteps.tip,
            status: journeySteps.status,
            completedAt: journeySteps.completedAt,
          })
          .from(journeySteps)
          .where(inArray(journeySteps.journeyId, journeyIds))
          .orderBy(asc(journeySteps.position))
      )
    : [];
  const fileRows = await optionalRows(
    db
      .select({
        journeyId: journeyFiles.journeyId,
        fileName: journeyFiles.fileName,
        mimeType: journeyFiles.mimeType,
        sizeBytes: journeyFiles.sizeBytes,
        summary: journeyFiles.summary,
        createdAt: journeyFiles.createdAt,
      })
      .from(journeyFiles)
      .where(eq(journeyFiles.userId, userId))
  );
  const coachingRows = await optionalRows(
    db
      .select({
        journeyId: journeyMessages.journeyId,
        role: journeyMessages.role,
        content: journeyMessages.content,
        createdAt: journeyMessages.createdAt,
      })
      .from(journeyMessages)
      .where(eq(journeyMessages.userId, userId))
      .orderBy(asc(journeyMessages.createdAt))
  );
  const forJourney = <T extends { journeyId: string }>(rows: T[], id: string) =>
    rows
      .filter((r) => r.journeyId === id)
      .map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== "journeyId")));

  const [metricsRow] = await optionalRows(
    db
      .select({
        consentedAt: lifeMetrics.consentedAt,
        archetype: lifeMetrics.archetype,
        tagline: lifeMetrics.tagline,
        summary: lifeMetrics.summary,
        categories: lifeMetrics.categories,
        computedAt: lifeMetrics.computedAt,
      })
      .from(lifeMetrics)
      .where(eq(lifeMetrics.userId, userId))
  );

  const memberships = await db
    .select({ organization: organizations.name, role: organizationMembers.role })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .where(eq(organizationMembers.userId, userId));

  const paymentRows = await db
    .select({
      plan: plans.name,
      amount: sql<number>`${payments.amountMinorUnits} / 100.0`,
      currency: payments.currency,
      status: payments.status,
      provider: payments.provider,
      reference: payments.providerPaymentId,
      paidAt: payments.paidAt,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .leftJoin(plans, eq(payments.planId, plans.id))
    .where(eq(payments.userId, userId));

  const data = {
    exportedAt: new Date().toISOString(),
    profile: { ...profile, ...((settingsRows as unknown[])[0] ?? {}) },
    conversations: conversations.map((c) => ({
      title: c.title,
      createdAt: c.createdAt,
      messages: (byConversation.get(c.id) ?? []).map(({ role, content, createdAt }) => ({
        role,
        content,
        createdAt,
      })),
    })),
    journeys: journeyRows.map(({ id, ...journey }) => ({
      ...journey,
      steps: forJourney(stepRows, id),
      files: forJourney(fileRows, id),
      coaching: forJourney(coachingRows, id),
    })),
    lifeMetrics: metricsRow ?? null,
    organizations: memberships,
    payments: paymentRows,
  };

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="z1p-data-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
