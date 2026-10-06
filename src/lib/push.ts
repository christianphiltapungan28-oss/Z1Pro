import webpush from "web-push";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { isMissingTable } from "@/lib/db-errors";

let configured: boolean | null = null;

/** True once the VAPID keys are set (see .env.example). */
export function pushConfigured() {
  if (configured === null) {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    configured = !!(publicKey && privateKey);
    if (configured) {
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || "mailto:support@z1p.pro",
        publicKey!,
        privateKey!,
      );
    }
  }
  return configured;
}

export type PushMessage = { title: string; body: string; url: string };

/**
 * Sends a push notification to every device the user allowed. Subscriptions
 * the push service reports as gone (404/410) are removed. Never throws.
 */
export async function sendPush(userId: string, message: PushMessage) {
  if (!pushConfigured()) return;
  try {
    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
    const gone: string[] = [];
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(message),
            { TTL: 24 * 60 * 60 },
          );
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) gone.push(s.id);
          else console.error("Push send failed", status);
        }
      }),
    );
    if (gone.length) {
      await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone));
    }
  } catch (err) {
    if (!isMissingTable(err)) console.error("Couldn't send push notification", err);
  }
}
