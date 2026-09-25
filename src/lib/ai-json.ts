import { openaiFetch } from "@/lib/openai";
import { getModelForPlan } from "@/lib/plan";
import { recordUsage } from "@/lib/usage-guard";

/** A user-message content part: text, a PDF, or an image. */
export type Content =
  | { type: "text"; text: string }
  | { type: "file"; file: { filename: string; file_data: string } }
  | { type: "image_url"; image_url: { url: string } };

/**
 * One JSON-mode completion on the cheapest model, for background analysis
 * (file plans, Life Metrics). Counts toward the daily token budget.
 */
export async function jsonCompletion(
  system: string,
  content: Content[],
  maxTokens: number
): Promise<Record<string, unknown>> {
  const res = await openaiFetch(
    "/chat/completions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: getModelForPlan("free"),
        max_completion_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content },
        ],
      }),
    },
    { timeoutMs: 90_000, maxRetries: 1 }
  );
  if (!res.ok) {
    throw new Error(`OpenAI ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const data = await res.json();
  const usage = data.usage ?? {};
  await recordUsage("chatTokens", (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0));
  return JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
}
