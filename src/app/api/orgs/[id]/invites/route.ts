import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { organizationInvites, organizationMembers } from "@/db/schema";
import { getAppOrigin } from "@/lib/app-url";
import { rateLimit } from "@/lib/rate-limit";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

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

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/orgs/[id]/invites">
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: orgId } = await ctx.params;
  const role = await getRole(orgId, userId);
  if (!role) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (role !== "owner" && role !== "admin") {
    return NextResponse.json(
      { error: "Only org owners or admins can create invites" },
      { status: 403 }
    );
  }

  const limit = await rateLimit(`invites:create:${orgId}`, 20, 60 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many invites created. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const body = await request.json().catch(() => ({}));
  const inviteRole = body?.role === "admin" ? "admin" : "member";
  const email =
    typeof body?.email === "string" && body.email.trim()
      ? body.email.trim().toLowerCase()
      : null;
  const expiresInDays =
    typeof body?.expiresInDays === "number" && body.expiresInDays > 0
      ? Math.min(body.expiresInDays, 30)
      : 7;

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60_000);

  const [invite] = await db
    .insert(organizationInvites)
    .values({
      organizationId: orgId,
      tokenHash: hashToken(token),
      role: inviteRole,
      email,
      createdByUserId: userId,
      expiresAt,
    })
    .returning();

  const origin = getAppOrigin(request);

  return NextResponse.json(
    {
      id: invite.id,
      role: invite.role,
      email: invite.email,
      expiresAt: invite.expiresAt,
      token,
      url: `${origin}/invite/${token}`,
    },
    { status: 201 }
  );
}

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/orgs/[id]/invites">
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: orgId } = await ctx.params;
  const role = await getRole(orgId, userId);
  if (!role) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (role !== "owner" && role !== "admin") {
    return NextResponse.json(
      { error: "Only org owners or admins can view invites" },
      { status: 403 }
    );
  }

  const invites = await db
    .select({
      id: organizationInvites.id,
      role: organizationInvites.role,
      email: organizationInvites.email,
      expiresAt: organizationInvites.expiresAt,
      createdAt: organizationInvites.createdAt,
      acceptedAt: organizationInvites.acceptedAt,
      revokedAt: organizationInvites.revokedAt,
    })
    .from(organizationInvites)
    .where(
      and(
        eq(organizationInvites.organizationId, orgId),
        isNull(organizationInvites.acceptedAt),
        isNull(organizationInvites.revokedAt)
      )
    );

  return NextResponse.json({ invites });
}
