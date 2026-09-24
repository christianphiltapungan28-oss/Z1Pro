/**
 * Every OpenAI call goes through here so each one has a timeout and a hard
 * cap on retries. Only failures where OpenAI did no billable work are
 * retried (rate limits, 5xx, connection errors); a 4xx means the request
 * itself is wrong and retrying would just fail again.
 */

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_RETRY_WAIT_MS = 4_000;

type OpenAIFetchOptions = {
  /** Per-attempt timeout. */
  timeoutMs: number;
  /** Retries after the first attempt. Keep this small: 0–2. */
  maxRetries?: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number, response?: Response) {
  const retryAfter = Number(response?.headers.get("retry-after"));
  const base =
    Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : 500 * 2 ** attempt;
  // Jitter so parallel requests don't retry in lockstep.
  return Math.min(MAX_RETRY_WAIT_MS, base) * (0.75 + Math.random() * 0.5);
}

export async function openaiFetch(
  path: string,
  init: RequestInit,
  { timeoutMs, maxRetries = 1 }: OpenAIFetchOptions
): Promise<Response> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const retries = Math.min(Math.max(0, maxRetries), 2);
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`https://api.openai.com/v1${path}`, {
        ...init,
        headers: { ...init.headers, Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok || !RETRYABLE_STATUS.has(res.status) || attempt === retries) {
        return res;
      }
      // An exhausted quota won't recover by retrying.
      const body = await res.text().catch(() => "");
      if (body.includes("insufficient_quota")) {
        return new Response(body, { status: res.status, headers: res.headers });
      }
      await sleep(backoffMs(attempt, res));
    } catch (err) {
      lastError = err;
      // A timeout may mean OpenAI is still working on (and billing) the
      // request, so retrying could pay for it twice. Give up instead.
      const timedOut = err instanceof Error && err.name === "TimeoutError";
      if (timedOut || attempt === retries) break;
      await sleep(backoffMs(attempt));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("OpenAI request failed");
}
