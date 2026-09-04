import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { fulfillPayment } from "@/lib/fulfill-payment";
import { verifyPaymongoSignature } from "@/lib/paymongo-webhook";

// Only the events this integration acts on. Unlisted event types are
// acknowledged (200) and ignored, per PayMongo's guidance — returning an
// error for an event you don't handle just triggers pointless retries.
const HANDLED_EVENT_TYPES = new Set(["checkout_session.payment.paid"]);

type PaymongoWebhookBody = {
  data?: {
    attributes?: {
      type?: string;
      livemode?: boolean;
      data?: {
        id?: string;
      };
    };
  };
};

export async function POST(request: Request) {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!secret) {
    console.error("PAYMONGO_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  // Must read as raw text before any parsing — PayMongo signs the exact
  // bytes it sent, so reformatting the body first breaks verification.
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("paymongo-signature");

  if (!verifyPaymongoSignature(rawBody, signatureHeader, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let body: PaymongoWebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const attributes = body.data?.attributes;
  const eventType = attributes?.type;
  const eventLivemode = attributes?.livemode;
  const sessionId = attributes?.data?.id;

  const expectedLivemode = Boolean(
    process.env.PAYMONGO_SECRET_KEY?.startsWith("sk_live_")
  );
  if (typeof eventLivemode === "boolean" && eventLivemode !== expectedLivemode) {
    // Wrong mode for this environment (test event hitting a live deployment,
    // or vice versa) — acknowledge without acting on it.
    return NextResponse.json({ received: true });
  }

  if (!eventType || !HANDLED_EVENT_TYPES.has(eventType) || !sessionId) {
    return NextResponse.json({ received: true });
  }

  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.providerPaymentId, sessionId))
    .limit(1);

  if (!payment) {
    // No matching payment row (e.g. a stale/foreign session id) — nothing
    // to do, but still acknowledge so PayMongo doesn't keep retrying.
    return NextResponse.json({ received: true });
  }

  await fulfillPayment(payment.id);

  return NextResponse.json({ received: true });
}
