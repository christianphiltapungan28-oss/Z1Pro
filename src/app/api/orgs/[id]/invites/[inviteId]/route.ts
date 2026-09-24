import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { organizationInvites, organizationMembers } from "@/db/schema";

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/orgs/[id]/invites/[inviteId]">
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: orgId, inviteId } = await ctx.params;

  const [membership] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.userId, userId)
      )
    )
    .limit(1);
  if (!membership) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (membership.role !== "owner" && membership.role !== "admin") {
    return NextResponse.json(
      { error: "Only org owners or admins can revoke invites" },
      { status: 403 }
    );
  }

  const [updated] = await db
    .update(organizationInvites)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(organizationInvites.id, inviteId),
        eq(organizationInvites.organizationId, orgId)
      )
    )
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
