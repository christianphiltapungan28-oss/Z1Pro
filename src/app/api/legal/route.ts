import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { legalAcceptances } from "@/db/schema";
import { isMissingTable } from "@/lib/db-errors";
import { LEGAL } from "@/lib/legal";

/**
 * Whether the signed-in user has accepted the current Terms and Conditions,
 * Privacy Policy and Cookie Policy (the modal shown after signing in).
 * GET — { ready, accepted, version }; `ready` is false until
 * scripts/migrations/add-legal-acceptance.sql has run, and then nothing is asked.
 * POST { version } — records acceptance of that version.
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const [row] = await db
      .select({ version: legalAcceptances.version })
      .from(legalAcceptances)
      .where(eq(legalAcceptances.userId, userId))
      .limit(1);
    return NextResponse.json({
      ready: true,
      accepted: row?.version === LEGAL.lastUpdated,
      version: LEGAL.lastUpdated,
    });
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ ready: false, accepted: false, version: LEGAL.lastUpdated });
    }
    throw err;
  }
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  // Only the policies on the site right now can be accepted: a stale tab
  // gets told to reload rather than recording an old version.
  if (body?.version !== LEGAL.lastUpdated) {
    return NextResponse.json(
      {
        error: "The policies have been updated. Please reload the page to see the latest versions.",
      },
      { status: 409 },
    );
  }
  const acceptedAt = new Date();
  try {
    await db
      .insert(legalAcceptances)
      .values({ userId, version: LEGAL.lastUpdated, acceptedAt })
      .onConflictDoUpdate({
        target: legalAcceptances.userId,
        set: { version: LEGAL.lastUpdated, acceptedAt },
      });
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: "This isn't available yet." }, { status: 503 });
    }
    throw err;
  }
  return NextResponse.json({ accepted: true });
}
