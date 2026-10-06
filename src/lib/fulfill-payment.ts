import { and, eq, ne } from "drizzle-orm";
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
 * Idempotent — a payment already marked "succeeded" is a no-op, even when
 * two calls race — so it's safe to call from both the webhook and the
 * browser redirect path without double-activating a subscription.
 */
export async function fulfillPayment(paymentId: string) {
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);

  if (!payment) return { ok: false as const, reason: "not_found" as const };
  if (payment.status === "succeeded") {
    return { ok: true as const, reason: "already_succeeded" as const };
  }
  if (!payment.planId) return { ok: false as const, reason: "no_plan" as const };
  if (!payment.orgId) return { ok: false as const, reason: "no_org" as const };

  const [plan] = await db.select().from(plans).where(eq(plans.id, payment.planId)).limit(1);

  if (!plan) return { ok: false as const, reason: "plan_not_found" as const };

  const orgId = payment.orgId;
  return db.transaction(async (tx) => {
    // The webhook and the browser redirect often land at the same moment.
    // Claiming the payment first means only one of them activates the
    // subscription; the other waits on the row lock, then sees it's taken.
    const [claimed] = await tx
      .update(payments)
      .set({ status: "succeeded", paidAt: new Date() })
      .where(and(eq(payments.id, payment.id), ne(payments.status, "succeeded")))
      .returning({ id: payments.id });
    if (!claimed) return { ok: true as const, reason: "already_succeeded" as const };

    await tx
      .update(subscriptions)
      .set({ status: "expired" })
      .where(and(eq(subscriptions.orgId, orgId), eq(subscriptions.status, "active")));

    const periodStart = new Date();
    const [subscription] = await tx
      .insert(subscriptions)
      .values({
        userId: payment.userId,
        orgId,
        planId: plan.id,
        status: "active",
        provider: payment.provider,
        providerSubscriptionId: payment.providerPaymentId,
        currentPeriodStart: periodStart,
        currentPeriodEnd: addInterval(periodStart, plan.billingInterval),
      })
      .returning();

    await tx
      .update(payments)
      .set({ subscriptionId: subscription.id })
      .where(eq(payments.id, payment.id));

    return { ok: true as const };
  });
}
