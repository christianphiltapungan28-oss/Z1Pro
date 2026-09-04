import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { getAppOrigin } from "@/lib/app-url";
import { fulfillPayment } from "@/lib/fulfill-payment";

export async function GET(request: Request) {
  const origin = getAppOrigin(request);
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

  // This redirect is driven by the customer's browser, not a verified
  // server-to-server call, so re-confirm the payment actually succeeded with
  // PayMongo's API before activating anything. (The webhook handler at
  // /api/webhooks/paymongo doesn't need this extra round trip — its HMAC
  // signature already proves PayMongo is the one reporting success.)
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

  const result = await fulfillPayment(payment.id);
  if (!result.ok) {
    return NextResponse.redirect(`${origin}/?checkout=error`);
  }

  return NextResponse.redirect(`${origin}/?checkout=success`);
}
