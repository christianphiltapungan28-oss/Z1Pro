import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { fulfillPayment } from "@/lib/fulfill-payment";
import { getStripeClient } from "@/lib/stripe";

// Only the events this integration acts on. Unlisted event types are
// acknowledged (200) and ignored, per Stripe's guidance — returning an error
// for an event you don't handle just triggers pointless retries.
const HANDLED_EVENT_TYPES = new Set(["checkout.session.completed"]);

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret || !process.env.STRIPE_SECRET_KEY) {
    console.error("Stripe webhook env vars are not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  // Must read as raw text before any parsing — Stripe signs the exact bytes
  // it sent, so reformatting the body first breaks verification.
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("stripe-signature");
  if (!signatureHeader) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(
      rawBody,
      signatureHeader,
      webhookSecret
    );
  } catch (err) {
    console.error("Stripe webhook signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (!HANDLED_EVENT_TYPES.has(event.type)) {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid") {
    return NextResponse.json({ received: true });
  }

  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.providerPaymentId, session.id))
    .limit(1);

  if (!payment) {
    return NextResponse.json({ received: true });
  }

  await fulfillPayment(payment.id);
  return NextResponse.json({ received: true });
}
