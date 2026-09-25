import { NextResponse } from "next/server";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  aiConversations,
  aiUsageDaily,
  journeys,
  oauthAccounts,
  organizationInvites,
  organizationMembers,
  organizations,
  sessions,
  users,
} from "@/db/schema";
import { deleteStoredFiles } from "@/lib/journey-flow";
import { storedFilePaths } from "@/lib/journey-flow-data";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Deletes the user's account. Personal content (chats, journeys, usage,
 * settings, sessions, sign-in links) is deleted outright. The user row is
 * anonymised rather than removed, because payments reference it and must be
 * kept for tax records — deleting the row would cascade to them.
 *
 * Blocked while the user is the only owner of an organization that still
 * has other members, so a team is never left without an owner.
 */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await rateLimit(`settings:delete:${userId}`, 5, 60 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const confirmEmail = typeof body?.confirmEmail === "string" ? body.confirmEmail.trim() : "";
  if (confirmEmail.toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json(
      { error: "Type your email address exactly to confirm." },
      { status: 400 }
    );
  }

  // Organizations this user owns where nobody else is an owner but other
  // people are still members.
  const owned = await db
    .select({ orgId: organizationMembers.organizationId, name: organizations.name })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.role, "owner")));

  const blocking: string[] = [];
  for (const org of owned) {
    const others = await db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, org.orgId),
          ne(organizationMembers.userId, userId)
        )
      );
    if (others.length > 0 && !others.some((m) => m.role === "owner")) {
      blocking.push(org.name);
    }
  }
  if (blocking.length > 0) {
    return NextResponse.json(
      {
        error: `Make someone else an owner of ${blocking.join(", ")} (or remove its other members) before deleting your account.`,
        organizations: blocking,
      },
      { status: 409 }
    );
  }

  const [{ hasSettings }] = await db.execute<{ hasSettings: boolean }>(
    sql`select to_regclass('public.user_settings') is not null as "hasSettings"`
  );

  const storedPaths = await storedFilePaths({ userId });

  await db.transaction(async (tx) => {
    await tx.delete(aiConversations).where(eq(aiConversations.userId, userId));
    await tx.delete(journeys).where(eq(journeys.userId, userId));
    await tx.delete(aiUsageDaily).where(eq(aiUsageDaily.userId, userId));
    if (hasSettings) {
      await tx.execute(sql`delete from user_settings where user_id = ${userId}`);
    }
    await tx
      .update(organizationInvites)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(organizationInvites.createdByUserId, userId),
          isNull(organizationInvites.acceptedAt),
          isNull(organizationInvites.revokedAt)
        )
      );
    // Organizations are kept (payments reference them); only this user's
    // memberships go.
    await tx.delete(organizationMembers).where(eq(organizationMembers.userId, userId));
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await tx.delete(oauthAccounts).where(eq(oauthAccounts.userId, userId));
    await tx
      .update(users)
      .set({
        email: `deleted+${userId}@users.z1p.invalid`,
        displayName: null,
        avatarUrl: null,
        emailVerifiedAt: null,
        defaultOrgId: null,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  });

  // Uploaded journey files in storage go too (their rows cascade above).
  await deleteStoredFiles(storedPaths);

  return NextResponse.json({ ok: true });
}
