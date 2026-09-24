import { NextResponse } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { payments, plans, subscriptions } from "@/db/schema";
import { getAppOrigin } from "@/lib/app-url";
import { getCurrentOrg } from "@/lib/current-org";
import { getCountryCode } from "@/lib/geo";
import { rateLimit } from "@/lib/rate-limit";
import { getStripeClient, STRIPE_ENABLED } from "@/lib/stripe";

export async function POST(request: Request) {
  const currentOrg = await getCurrentOrg();
  if (!currentOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (currentOrg.role === "member") {
    return NextResponse.json(
      { error: "Only org owners or admins can manage billing" },
      { status: 403 }
    );
  }
  const { userId, orgId } = currentOrg;

  const limit = await rateLimit(`checkout:${orgId}`, 10, 60 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many checkout attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const body = await request.json().catch(() => ({}));
  const planCode = typeof body?.planCode === "string" ? body.planCode : "";

  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.code, planCode))
    .limit(1);

  if (!plan || !plan.isActive || plan.priceMinorUnits === null) {
    return NextResponse.json({ error: "Plan not available" }, { status: 400 });
  }

  const [existingActive] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.orgId, orgId),
        eq(subscriptions.planId, plan.id),
        eq(subscriptions.status, "active"),
        gt(subscriptions.currentPeriodEnd, new Date())
      )
    )
    .limit(1);
  if (existingActive) {
    return NextResponse.json(
      { error: "Already on this plan" },
      { status: 400 }
    );
  }

  // Only look up the visitor's country (which sends their IP to ipwho.is)
  // when it can actually change the provider.
  const useStripe =
    STRIPE_ENABLED &&
    plan.priceUsdMinorUnits !== null &&
    (await getCountryCode(request)) !== "PH";

  const origin = getAppOrigin(request);

  if (useStripe) {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: "Payments are not configured" },
        { status: 500 }
      );
    }

    const [payment] = await db
      .insert(payments)
      .values({
        userId,
        orgId,
        planId: plan.id,
        amountMinorUnits: plan.priceUsdMinorUnits!,
        currency: "USD",
        status: "pending",
        provider: "stripe",
      })
      .returning();

    const checkoutSession = await getStripeClient().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: plan.priceUsdMinorUnits!,
            product_data: { name: plan.name },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/api/checkout/complete?payment=${payment.id}`,
      cancel_url: `${origin}/?checkout=cancelled`,
    });

    await db
      .update(payments)
      .set({ providerPaymentId: checkoutSession.id })
      .where(eq(payments.id, payment.id));

    return NextResponse.json({ checkoutUrl: checkoutSession.url });
  }

  const secretKey = process.env.PAYMONGO_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json(
      { error: "Payments are not configured" },
      { status: 500 }
    );
  }

  const [payment] = await db
    .insert(payments)
    .values({
      userId,
      orgId,
      planId: plan.id,
      amountMinorUnits: plan.priceMinorUnits,
      currency: plan.currency,
      status: "pending",
      provider: "paymongo",
    })
    .returning();

  const auth64 = Buffer.from(`${secretKey}:`).toString("base64");

  const checkoutRes = await fetch(
    "https://api.paymongo.com/v1/checkout_sessions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth64}`,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            send_email_receipt: false,
            show_description: true,
            show_line_items: true,
            line_items: [
              {
                currency: plan.currency,
                amount: plan.priceMinorUnits,
                name: plan.name,
                quantity: 1,
              },
            ],
            payment_method_types: ["gcash", "card", "paymaya"],
            description: `${plan.name} plan - Z1P.pro`,
            success_url: `${origin}/api/checkout/complete?payment=${payment.id}`,
            cancel_url: `${origin}/?checkout=cancelled`,
          },
        },
      }),
    }
  );

  if (!checkoutRes.ok) {
    const errorText = await checkoutRes.text().catch(() => "");
    console.error("PayMongo checkout session failed", checkoutRes.status, errorText);
    await db
      .update(payments)
      .set({ status: "failed", failureReason: "checkout_session_create_failed" })
      .where(eq(payments.id, payment.id));
    return NextResponse.json(
      { error: "Could not start checkout" },
      { status: 502 }
    );
  }

  const checkout = await checkoutRes.json();
  const checkoutSessionId: string = checkout.data.id;
  const checkoutUrl: string = checkout.data.attributes.checkout_url;

  await db
    .update(payments)
    .set({ providerPaymentId: checkoutSessionId })
    .where(eq(payments.id, payment.id));

  return NextResponse.json({ checkoutUrl });
}
