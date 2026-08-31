import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { plans, subscriptions } from "@/db/schema";

export const PLAN_LIMITS: Record<
  string,
  { dailyMessageLimit: number | null; model: string; modelLabel: string }
> = {
  free: {
    dailyMessageLimit: 20,
    model: "gpt-5.6-luna",
    modelLabel: "GPT 5.6 Luna",
  },
  premium: {
    dailyMessageLimit: 150,
    model: "gpt-5.6-terra",
    modelLabel: "GPT 5.6 Terra",
  },
  pro: {
    dailyMessageLimit: null,
    model: "gpt-5.6-sol",
    modelLabel: "GPT 5.6 Sol",
  },
};

export function getDailyMessageLimit(planCode: string): number | null {
  return PLAN_LIMITS[planCode]?.dailyMessageLimit ?? PLAN_LIMITS.free.dailyMessageLimit;
}

export function getModelForPlan(planCode: string): string {
  return PLAN_LIMITS[planCode]?.model ?? PLAN_LIMITS.free.model;
}

export function getModelLabelForPlan(planCode: string): string {
  return PLAN_LIMITS[planCode]?.modelLabel ?? PLAN_LIMITS.free.modelLabel;
}

export async function getCurrentPlanCode(userId: string): Promise<string> {
  const [activeSubscription] = await db
    .select({ code: plans.code })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(
      and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active"))
    )
    .orderBy(desc(subscriptions.currentPeriodStart))
    .limit(1);

  return activeSubscription?.code ?? "free";
}
