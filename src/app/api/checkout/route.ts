import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { payments, plans } from "@/db/schema";

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secretKey = process.env.PAYMONGO_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json(
      { error: "Payments are not configured" },
      { status: 500 }
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

  const [payment] = await db
    .insert(payments)
    .values({
      userId,
      planId: plan.id,
      amountMinorUnits: plan.priceMinorUnits,
      currency: plan.currency,
      status: "pending",
      provider: "paymongo",
    })
    .returning();

  const origin = new URL(request.url).origin;
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
