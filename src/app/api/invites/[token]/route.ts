import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { organizationInvites, organizations } from "@/db/schema";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/invites/[token]">
) {
  const session = await auth();
  const email = session?.user?.email ?? null;

  const { token } = await ctx.params;

  const [invite] = await db
    .select({
      id: organizationInvites.id,
      role: organizationInvites.role,
      email: organizationInvites.email,
      expiresAt: organizationInvites.expiresAt,
      acceptedAt: organizationInvites.acceptedAt,
      revokedAt: organizationInvites.revokedAt,
      orgName: organizations.name,
    })
    .from(organizationInvites)
    .innerJoin(
      organizations,
      eq(organizationInvites.organizationId, organizations.id)
    )
    .where(eq(organizationInvites.tokenHash, hashToken(token)))
    .limit(1);

  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }
  if (invite.revokedAt || invite.acceptedAt || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invite is no longer valid" }, { status: 410 });
  }

  return NextResponse.json({
    orgName: invite.orgName,
    role: invite.role,
    email: invite.email,
    emailMatches: invite.email ? invite.email === email : true,
    signedIn: Boolean(session?.user?.id),
  });
}
