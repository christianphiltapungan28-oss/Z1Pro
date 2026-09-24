import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { organizationMembers, organizations } from "@/db/schema";

async function getMembership(orgId: string, userId: string) {
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
  return membership ?? null;
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/orgs/[id]">
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const membership = await getMembership(id, userId);
  if (!membership) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (membership.role !== "owner") {
    return NextResponse.json(
      { error: "Only the organization owner can rename it" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json(
      { error: "Organization name is required" },
      { status: 400 }
    );
  }

  const [updated] = await db
    .update(organizations)
    .set({ name, updatedAt: new Date() })
    .where(eq(organizations.id, id))
    .returning();

  return NextResponse.json(updated);
}
