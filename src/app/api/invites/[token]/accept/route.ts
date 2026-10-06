import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { organizationInvites, organizationMembers, users } from "@/db/schema";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(_request: Request, ctx: RouteContext<"/api/invites/[token]/accept">) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token } = await ctx.params;

  const [invite] = await db
    .select()
    .from(organizationInvites)
    .where(eq(organizationInvites.tokenHash, hashToken(token)))
    .limit(1);

  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }
  if (invite.revokedAt || invite.acceptedAt || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invite is no longer valid" }, { status: 410 });
  }
  // Invite emails are stored lowercased; a provider's email may not be.
  if (invite.email && invite.email !== session?.user?.email?.toLowerCase()) {
    return NextResponse.json(
      { error: "This invite was sent to a different email address" },
      { status: 403 },
    );
  }

  const accepted = await db.transaction(async (tx) => {
    // Claim the invite first so two accepts at once can't both use it.
    const [claimed] = await tx
      .update(organizationInvites)
      .set({ acceptedByUserId: userId, acceptedAt: new Date() })
      .where(and(eq(organizationInvites.id, invite.id), isNull(organizationInvites.acceptedAt)))
      .returning({ id: organizationInvites.id });
    if (!claimed) return false;

    await tx
      .insert(organizationMembers)
      .values({ organizationId: invite.organizationId, userId, role: invite.role })
      .onConflictDoNothing();

    await tx
      .update(users)
      .set({ defaultOrgId: invite.organizationId, updatedAt: new Date() })
      .where(eq(users.id, userId));
    return true;
  });
  if (!accepted) {
    return NextResponse.json({ error: "Invite is no longer valid" }, { status: 410 });
  }

  return NextResponse.json({ ok: true, orgId: invite.organizationId });
}
