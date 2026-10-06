/** True once SEMAPHORE_API_KEY is set (see .env.example). */
export function smsConfigured() {
  return !!process.env.SEMAPHORE_API_KEY;
}

/**
 * Sends one SMS through Semaphore (https://semaphore.co), a Philippine SMS
 * gateway. `number` is a PH mobile like "09171234567" or "+639171234567".
 * Returns false (and logs) on failure.
 */
export async function sendSms(number: string, message: string) {
  if (!smsConfigured()) return false;
  const params = new URLSearchParams({
    apikey: process.env.SEMAPHORE_API_KEY!,
    number,
    message,
  });
  if (process.env.SEMAPHORE_SENDER_NAME)
    params.set("sendername", process.env.SEMAPHORE_SENDER_NAME);
  try {
    const res = await fetch("https://api.semaphore.co/api/v4/messages", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.error("Semaphore SMS failed", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error("Semaphore SMS failed", err);
    return false;
  }
}
