import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { organizationMembers, users } from "@/db/schema";

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const orgId = typeof body?.orgId === "string" ? body.orgId : "";
  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }

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

  await db
    .update(users)
    .set({ defaultOrgId: orgId, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return NextResponse.json({ orgId, role: membership.role });
}
