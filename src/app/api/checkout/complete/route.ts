import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { organizationMembers, payments } from "@/db/schema";
import { getAppOrigin } from "@/lib/app-url";
import { fulfillPayment } from "@/lib/fulfill-payment";
import { rateLimit } from "@/lib/rate-limit";
import { getStripeClient } from "@/lib/stripe";

export async function GET(request: Request) {
  const origin = getAppOrigin(request);
  const paymentId = new URL(request.url).searchParams.get("payment");

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || !paymentId || !/^[0-9a-f-]{36}$/i.test(paymentId)) {
    return NextResponse.redirect(`${origin}/?checkout=error`);
  }

  // Each hit re-checks the payment with PayMongo or Stripe, so cap how often
  // one user can trigger that (a normal checkout needs one or two).
  const limit = await rateLimit(`checkout:complete:${userId}`, 20, 10 * 60_000);
  if (!limit.ok) {
    return NextResponse.redirect(`${origin}/?checkout=pending`);
  }

  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1);

  if (!payment || !payment.providerPaymentId || !payment.orgId) {
    return NextResponse.redirect(`${origin}/?checkout=error`);
  }

  // The payment may not belong to the caller's *current* default org (they
  // may have started checkout for an org they've since switched away from),
  // so check membership in the payment's org directly rather than via
  // getCurrentOrg().
  const [membership] = await db
    .select({ userId: organizationMembers.userId })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, payment.orgId),
        eq(organizationMembers.userId, userId)
      )
    )
    .limit(1);
  if (!membership) {
    return NextResponse.redirect(`${origin}/?checkout=error`);
  }

  if (payment.status === "succeeded") {
    return NextResponse.redirect(`${origin}/?checkout=success`);
  }

  // This redirect is driven by the customer's browser, not a verified
  // server-to-server call, so re-confirm the payment actually succeeded with
  // the provider's API before activating anything. (The webhook handlers at
  // /api/webhooks/paymongo and /api/webhooks/stripe don't need this extra
  // round trip — their signatures already prove the provider is the one
  // reporting success.)
  if (payment.provider === "stripe") {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.redirect(`${origin}/?checkout=error`);
    }

    const checkoutSession = await getStripeClient().checkout.sessions.retrieve(
      payment.providerPaymentId
    );
    if (checkoutSession.payment_status !== "paid") {
      return NextResponse.redirect(`${origin}/?checkout=pending`);
    }
  } else {
    const secretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.redirect(`${origin}/?checkout=error`);
    }

    const auth64 = Buffer.from(`${secretKey}:`).toString("base64");
    const checkoutRes = await fetch(
      `https://api.paymongo.com/v1/checkout_sessions/${payment.providerPaymentId}`,
      {
        headers: { Authorization: `Basic ${auth64}` },
        signal: AbortSignal.timeout(15_000),
      }
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
  }

  const result = await fulfillPayment(payment.id);
  if (!result.ok) {
    return NextResponse.redirect(`${origin}/?checkout=error`);
  }

  return NextResponse.redirect(`${origin}/?checkout=success`);
}
