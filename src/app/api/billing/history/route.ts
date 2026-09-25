import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { payments, plans } from "@/db/schema";
import { getCurrentOrg } from "@/lib/current-org";

/**
 * Payments for Settings → Subscription. Owners and admins see everything
 * paid for their current organization; members see only their own.
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const org = await getCurrentOrg();
  const scope =
    org && org.role !== "member"
      ? eq(payments.orgId, org.orgId)
      : eq(payments.userId, userId);

  const rows = await db
    .select({
      id: payments.id,
      plan: plans.name,
      amountMinorUnits: payments.amountMinorUnits,
      currency: payments.currency,
      status: payments.status,
      provider: payments.provider,
      date: sql<string>`coalesce(${payments.paidAt}, ${payments.createdAt})`,
    })
    .from(payments)
    .leftJoin(plans, eq(payments.planId, plans.id))
    .where(scope)
    .orderBy(desc(payments.createdAt))
    .limit(50);

  return NextResponse.json({ payments: rows });
}
