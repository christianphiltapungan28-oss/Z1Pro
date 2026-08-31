import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { plans } from "@/db/schema";
import { getCurrentPlanCode } from "@/lib/plan";

function planFeatures(features: Record<string, unknown>): string[] {
  const items = features.items;
  return Array.isArray(items)
    ? items.filter((item): item is string => typeof item === "string")
    : [];
}

export async function GET() {
  const activePlans = await db
    .select()
    .from(plans)
    .where(eq(plans.isActive, true))
    .orderBy(asc(plans.sortOrder));

  const session = await auth();
  const currentPlanCode = session?.user?.id
    ? await getCurrentPlanCode(session.user.id)
    : "free";

  return NextResponse.json({
    plans: activePlans.map((plan) => ({
      code: plan.code,
      name: plan.name,
      description: plan.description,
      priceMinorUnits: plan.priceMinorUnits,
      currency: plan.currency,
      billingInterval: plan.billingInterval,
      features: planFeatures(plan.features ?? {}),
    })),
    currentPlanCode,
  });
}
