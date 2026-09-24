import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { organizationMembers, organizations, users } from "@/db/schema";
import { rateLimit } from "@/lib/rate-limit";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db
    .select({ defaultOrgId: users.defaultOrgId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      role: organizationMembers.role,
    })
    .from(organizationMembers)
    .innerJoin(
      organizations,
      eq(organizationMembers.organizationId, organizations.id)
    )
    .where(eq(organizationMembers.userId, userId));

  return NextResponse.json({
    organizations: rows.map((row) => ({
      ...row,
      isDefault: row.id === user?.defaultOrgId,
    })),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await rateLimit(`orgs:create:${userId}`, 10, 60 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many organizations created. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
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

  const [org] = await db.insert(organizations).values({ name }).returning();

  await db.insert(organizationMembers).values({
    organizationId: org.id,
    userId,
    role: "owner",
  });

  await db
    .update(users)
    .set({ defaultOrgId: org.id })
    .where(eq(users.id, userId));

  return NextResponse.json(org, { status: 201 });
}
