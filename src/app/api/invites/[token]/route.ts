import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { organizationInvites, organizations } from "@/db/schema";
import { clientIp, rateLimit } from "@/lib/rate-limit";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/invites/[token]">
) {
  // Works without signing in, so limit by IP to stop bots from hammering
  // the database with guessed tokens.
  const limit = await rateLimit(`invites:lookup:${clientIp(request)}`, 30, 10 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const session = await auth();
  const email = session?.user?.email ?? null;

  const { token } = await ctx.params;
  if (token.length > 100) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

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
