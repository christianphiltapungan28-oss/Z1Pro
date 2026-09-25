import { NextResponse } from "next/server";
import { and, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { currentSessionHash } from "@/lib/session-token";

/** The user's signed-in sessions, with the one making this request marked. */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const current = await currentSessionHash();
  const rows = await db
    .select({
      id: sessions.id,
      tokenHash: sessions.tokenHash,
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date())
      )
    )
    .orderBy(desc(sessions.createdAt))
    .limit(50);

  return NextResponse.json({
    sessions: rows.map(({ tokenHash, ...rest }) => ({
      ...rest,
      current: tokenHash === current,
    })),
  });
}

/** Signs out every other device, keeping this one. */
export async function DELETE() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const current = await currentSessionHash();
  const rows = await db
    .select({ id: sessions.id, tokenHash: sessions.tokenHash })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));

  const others = rows.filter((r) => r.tokenHash !== current).map((r) => r.id);
  if (others.length > 0) {
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.userId, userId), inArray(sessions.id, others)));
  }

  return NextResponse.json({ revoked: others.length });
}
