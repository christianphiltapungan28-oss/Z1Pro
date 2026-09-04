import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { payments, plans, subscriptions } from "@/db/schema";

function addInterval(start: Date, interval: string | null) {
  const end = new Date(start);
  if (interval === "year") {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return end;
}

/**
 * Activates the subscription for a payment PayMongo has confirmed as paid.
 * Idempotent — a payment already marked "succeeded" is a no-op — so it's
 * safe to call from both the webhook and the browser redirect path without
 * double-activating a subscription.
 */
export async function fulfillPayment(paymentId: string) {
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1);

  if (!payment) return { ok: false as const, reason: "not_found" as const };
  if (payment.status === "succeeded") {
    return { ok: true as const, reason: "already_succeeded" as const };
  }
  if (!payment.planId) return { ok: false as const, reason: "no_plan" as const };

  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.id, payment.planId))
    .limit(1);

  if (!plan) return { ok: false as const, reason: "plan_not_found" as const };

  await db
    .update(subscriptions)
    .set({ status: "expired" })
    .where(
      and(eq(subscriptions.userId, payment.userId), eq(subscriptions.status, "active"))
    );

  const periodStart = new Date();
  const [subscription] = await db
    .insert(subscriptions)
    .values({
      userId: payment.userId,
      planId: plan.id,
      status: "active",
      provider: "paymongo",
      providerSubscriptionId: payment.providerPaymentId,
      currentPeriodStart: periodStart,
      currentPeriodEnd: addInterval(periodStart, plan.billingInterval),
    })
    .returning();

  await db
    .update(payments)
    .set({
      status: "succeeded",
      paidAt: new Date(),
      subscriptionId: subscription.id,
    })
    .where(eq(payments.id, payment.id));

  return { ok: true as const };
}
