import { redis } from "@/lib/rate-limit";

/**
 * Site-wide daily budgets for paid AI usage — the last line of defence
 * against a surprise bill from a bug, a bot, or a leaked account. Each
 * metric has a hard daily limit (AI calls of that kind are refused once
 * it's reached, until midnight UTC) and alerts at 50% and 80% of it.
 *
 * Tune the limits with env vars; the defaults are deliberately modest for
 * an early-stage app. These complement, not replace, the monthly budget
 * and alert emails you should also set in the OpenAI dashboard.
 */
const METRICS = {
  // Chat input + output tokens across all users.
  chatTokens: { env: "AI_DAILY_CHAT_TOKEN_LIMIT", fallback: 5_000_000 },
  // Characters sent to text-to-speech across all users.
  speechChars: { env: "AI_DAILY_SPEECH_CHAR_LIMIT", fallback: 1_000_000 },
  // Audio kilobytes sent for transcription across all users.
  transcribeKb: { env: "AI_DAILY_TRANSCRIBE_KB_LIMIT", fallback: 500_000 },
} as const;

export type UsageMetric = keyof typeof METRICS;

const ALERT_LEVELS = [0.5, 0.8, 1];

function dailyLimit(metric: UsageMetric) {
  const { env, fallback } = METRICS[metric];
  const configured = Number(process.env[env]);
  return Number.isFinite(configured) && configured > 0 ? configured : fallback;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function counterKey(metric: UsageMetric) {
  return `usage:global:${today()}:${metric}`;
}

/** True when today's budget for this metric is already used up. */
export async function isOverDailyBudget(metric: UsageMetric) {
  try {
    const used = Number((await redis.get<number>(counterKey(metric))) ?? 0);
    return used >= dailyLimit(metric);
  } catch (err) {
    // Fail open: a Redis outage shouldn't take the whole assistant down.
    // The per-user limits still apply, and they fail closed.
    console.error("[usage-guard] budget check failed", err);
    return false;
  }
}

/** Adds usage after a paid call and fires threshold alerts. Never throws. */
export async function recordUsage(metric: UsageMetric, amount: number) {
  if (!(amount > 0)) return;
  try {
    const key = counterKey(metric);
    const total = await redis.incrby(key, Math.round(amount));
    if (total === Math.round(amount)) await redis.expire(key, 2 * 24 * 3600);

    const limit = dailyLimit(metric);
    for (const level of ALERT_LEVELS) {
      if (total >= limit * level && total - amount < limit * level) {
        await sendAlert(
          `usage:${metric}:${level}`,
          level >= 1
            ? `Daily ${metric} budget reached (${total.toLocaleString()} / ${limit.toLocaleString()}). AI calls of this kind are paused until 00:00 UTC.`
            : `Daily ${metric} usage at ${level * 100}% of budget (${total.toLocaleString()} / ${limit.toLocaleString()}).`
        );
      }
    }
  } catch (err) {
    console.error("[usage-guard] failed to record usage", err);
  }
}

/**
 * Sends an alert at most once per day per `dedupeKey`. Always logs with a
 * searchable [usage-alert] tag; also posts to ALERT_WEBHOOK_URL (a Slack or
 * Discord incoming webhook) when it's set. Never throws.
 */
export async function sendAlert(dedupeKey: string, message: string) {
  try {
    const fresh = await redis.set(`alert:${today()}:${dedupeKey}`, 1, {
      nx: true,
      ex: 24 * 3600,
    });
    if (!fresh) return;

    console.error(`[usage-alert] ${message}`);

    const webhook = process.env.ALERT_WEBHOOK_URL;
    if (webhook) {
      const text = `Z1P.pro usage alert: ${message}`;
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Slack reads `text`, Discord reads `content`; each ignores the other.
        body: JSON.stringify({ text, content: text }),
        signal: AbortSignal.timeout(5_000),
      });
    }
  } catch (err) {
    console.error("[usage-alert] failed to send alert", err);
  }
}
