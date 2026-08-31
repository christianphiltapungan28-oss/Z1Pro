import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
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

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const paymentId = new URL(request.url).searchParams.get("payment");

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || !paymentId) {
    return NextResponse.redirect(`${origin}/?checkout=error`);
  }

  const [payment] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.id, paymentId), eq(payments.userId, userId)))
    .limit(1);

  if (!payment || !payment.providerPaymentId) {
    return NextResponse.redirect(`${origin}/?checkout=error`);
  }

  if (payment.status === "succeeded") {
    return NextResponse.redirect(`${origin}/?checkout=success`);
  }

  const secretKey = process.env.PAYMONGO_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.redirect(`${origin}/?checkout=error`);
  }

  const auth64 = Buffer.from(`${secretKey}:`).toString("base64");
  const checkoutRes = await fetch(
    `https://api.paymongo.com/v1/checkout_sessions/${payment.providerPaymentId}`,
    { headers: { Authorization: `Basic ${auth64}` } }
  );

  if (!checkoutRes.ok) {
    return NextResponse.redirect(`${origin}/?checkout=error`);
  }

  const checkout = await checkoutRes.json();
  const paymentIntentStatus: string | undefined =
    checkout.data?.attributes?.payment_intent?.attributes?.status;

  if (paymentIntentStatus !== "succeeded") {
    return NextResponse.redirect(`${origin}/?checkout=pending`);
  }

  if (!payment.planId) {
    return NextResponse.redirect(`${origin}/?checkout=error`);
  }

  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.id, payment.planId))
    .limit(1);

  if (!plan) {
    return NextResponse.redirect(`${origin}/?checkout=error`);
  }

  await db
    .update(subscriptions)
    .set({ status: "expired" })
    .where(
      and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active"))
    );

  const periodStart = new Date();
  const [subscription] = await db
    .insert(subscriptions)
    .values({
      userId,
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

  return NextResponse.redirect(`${origin}/?checkout=success`);
}
