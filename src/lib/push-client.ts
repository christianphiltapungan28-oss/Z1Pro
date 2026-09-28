"use client";

// Browser side of web push: register /sw.js, subscribe this device and tell
// the server (/api/push).

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    PUBLIC_KEY !== ""
  );
}

function keyBytes(base64url: string) {
  const padded = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** This device's current push subscription, if any. */
export async function currentPushSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/**
 * Asks permission, subscribes this device and registers it with the server.
 * Returns null on success, or a message to show.
 */
export async function enablePush(): Promise<string | null> {
  if (!pushSupported()) {
    return "This browser can't show notifications. On iPhone, add Z1P to your Home Screen first.";
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return "Notifications are blocked for Z1P. Allow them in your browser's site settings.";
  }
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(PUBLIC_KEY),
      }));
    const res = await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return body?.error ?? "Couldn't turn on push notifications. Please try again.";
    }
    return null;
  } catch {
    return "Couldn't turn on push notifications. Please try again.";
  }
}

/** Unsubscribes this device and removes it on the server. */
export async function disablePush() {
  const sub = await currentPushSubscription();
  if (!sub) return;
  await fetch("/api/push", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => null);
  await sub.unsubscribe().catch(() => false);
}
