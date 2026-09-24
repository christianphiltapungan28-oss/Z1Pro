import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { organizationMembers, users } from "@/db/schema";

async function getRole(orgId: string, userId: string) {
  const [row] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.userId, userId)
      )
    )
    .limit(1);
  return row?.role ?? null;
}

async function countOtherOwners(orgId: string, excludingUserId: string) {
  const rows = await db
    .select({ userId: organizationMembers.userId })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.role, "owner"),
        ne(organizationMembers.userId, excludingUserId)
      )
    );
  return rows.length;
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/orgs/[id]/members/[userId]">
) {
  const session = await auth();
  const callerId = session?.user?.id;
  if (!callerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: orgId, userId: targetUserId } = await ctx.params;

  const callerRole = await getRole(orgId, callerId);
  if (!callerRole) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (callerRole !== "owner") {
    return NextResponse.json(
      { error: "Only the organization owner can change roles" },
      { status: 403 }
    );
  }

  const targetRole = await getRole(orgId, targetUserId);
  if (!targetRole) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const role = body?.role;
  if (role !== "owner" && role !== "admin" && role !== "member") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  if (
    targetRole === "owner" &&
    role !== "owner" &&
    (await countOtherOwners(orgId, targetUserId)) === 0
  ) {
    return NextResponse.json(
      { error: "An organization must have at least one owner" },
      { status: 400 }
    );
  }

  const [updated] = await db
    .update(organizationMembers)
    .set({ role })
    .where(
      and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.userId, targetUserId)
      )
    )
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/orgs/[id]/members/[userId]">
) {
  const session = await auth();
  const callerId = session?.user?.id;
  if (!callerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: orgId, userId: targetUserId } = await ctx.params;

  const callerRole = await getRole(orgId, callerId);
  if (!callerRole) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isSelf = callerId === targetUserId;
  if (!isSelf && callerRole !== "owner" && callerRole !== "admin") {
    return NextResponse.json(
      { error: "Only org owners or admins can remove members" },
      { status: 403 }
    );
  }

  const targetRole = await getRole(orgId, targetUserId);
  if (!targetRole) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (
    targetRole === "owner" &&
    (await countOtherOwners(orgId, targetUserId)) === 0
  ) {
    return NextResponse.json(
      { error: "An organization must have at least one owner" },
      { status: 400 }
    );
  }

  await db
    .delete(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.userId, targetUserId)
      )
    );

  // If the removed member's default org was this one, point them at another
  // org they belong to (or clear it) so they're not left with a dangling
  // defaultOrgId.
  const [remaining] = await db
    .select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, targetUserId))
    .limit(1);

  await db
    .update(users)
    .set({ defaultOrgId: remaining?.organizationId ?? null, updatedAt: new Date() })
    .where(and(eq(users.id, targetUserId), eq(users.defaultOrgId, orgId)));

  return NextResponse.json({ ok: true });
}
