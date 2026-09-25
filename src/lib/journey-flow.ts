import { jsonCompletion, type Content } from "@/lib/ai-json";

// ---------------------------------------------------------------------------
// Uploads

/** Files the AI can read directly: PDFs, images and plain text. */
export const ACCEPTED_TYPES: Record<string, "pdf" | "image" | "text"> = {
  "application/pdf": "pdf",
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "image/gif": "image",
  "text/plain": "text",
  "text/markdown": "text",
};

// Big enough for a typical assignment brief; each file is read by the AI
// once, and larger files cost more to analyse.
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TEXT_CHARS = 30_000;

export function acceptLabel() {
  return "PDF, image (PNG, JPG, WebP) or text file, up to 8 MB";
}

// ---------------------------------------------------------------------------
// Optional original-file storage in a private Supabase Storage bucket.
// Configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and (optionally)
// JOURNEY_FILES_BUCKET; without them files are analysed but not kept.

const BUCKET = process.env.JOURNEY_FILES_BUCKET || "journey-files";

function storageConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

export async function storeOriginal(
  path: string,
  bytes: ArrayBuffer,
  mimeType: string
): Promise<string | null> {
  const config = storageConfig();
  if (!config) return null;
  try {
    const res = await fetch(`${config.url}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.key}`,
        "Content-Type": mimeType,
        "x-upsert": "false",
      },
      body: bytes,
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      console.error("Journey file upload to storage failed", res.status, await res.text().catch(() => ""));
      return null;
    }
    return path;
  } catch (err) {
    console.error("Journey file upload to storage failed", err);
    return null;
  }
}

/** Best-effort removal of stored originals (journey or account deletion). */
export async function deleteStoredFiles(paths: string[]) {
  const config = storageConfig();
  if (!config || paths.length === 0) return;
  try {
    await fetch(`${config.url}/storage/v1/object/${BUCKET}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: paths }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    console.error("Deleting stored journey files failed", err);
  }
}

// ---------------------------------------------------------------------------
// AI analysis (always the cheapest model — it runs once per file)

export type PlannedStep = { title: string; tip: string };

export type FileAnalysis = {
  summary: string;
  steps: PlannedStep[];
  firstMessage: string;
};

const PLAN_PROMPT = `You turn a student's assignment or goal into a coaching plan for Zip, an AI coach who guides but never does the work for them. Reply with JSON only:
{"summary": string (what is being asked: requirements, length, format, deadline; max 600 characters),
 "steps": [{"title": string (2-6 words, starts with a verb), "tip": string (one practical tip for this step, max 200 characters)}] (3 to 6 steps, in order),
 "firstMessage": string (1-3 sentences that start step 1 with a question to the student)}
If the material is not an assignment or goal, still produce sensible steps for what the person seems to want to do.`;

const SUMMARY_PROMPT = `Summarise this extra file a student added to their assignment journey, in at most 500 characters: what it contains and how it relates to the work. Reply with JSON only: {"summary": string, "reply": string (1-2 sentences acknowledging the file to the student)}`;

export function fileContent(name: string, mimeType: string, bytes: ArrayBuffer): Content {
  const kind = ACCEPTED_TYPES[mimeType];
  const b64 = Buffer.from(bytes).toString("base64");
  if (kind === "pdf") {
    return { type: "file", file: { filename: name, file_data: `data:application/pdf;base64,${b64}` } };
  }
  if (kind === "image") {
    return { type: "image_url", image_url: { url: `data:${mimeType};base64,${b64}` } };
  }
  const text = Buffer.from(bytes).toString("utf8").slice(0, MAX_TEXT_CHARS);
  return { type: "text", text: `File "${name}":\n${text}` };
}

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function normalisePlan(raw: Record<string, unknown>): FileAnalysis | null {
  const steps = Array.isArray(raw.steps)
    ? raw.steps
        .map((s) => ({
          title: clean((s as PlannedStep)?.title, 80),
          tip: clean((s as PlannedStep)?.tip, 240),
        }))
        .filter((s) => s.title)
        .slice(0, 6)
    : [];
  if (steps.length < 2) return null;
  return {
    summary: clean(raw.summary, 800),
    steps,
    firstMessage:
      clean(raw.firstMessage, 600) ||
      `Let's start with "${steps[0].title}". What do you already know about it?`,
  };
}

/** Reads the material and plans the journey's steps. */
export async function planFromContent(journeyTitle: string, content: Content[]) {
  const raw = await jsonCompletion(
    PLAN_PROMPT,
    [{ type: "text", text: `Journey: ${journeyTitle}` }, ...content],
    1500
  );
  return normalisePlan(raw);
}

/** Summarises an additional file once the plan already exists. */
export async function summariseExtraFile(content: Content) {
  const raw = await jsonCompletion(SUMMARY_PROMPT, [content], 500);
  return {
    summary: clean(raw.summary, 600),
    reply: clean(raw.reply, 400) || "Thanks — I've added that file to what we're working with.",
  };
}

// ---------------------------------------------------------------------------
// Coaching

export const STEP_COMPLETE_MARKER = "[[STEP_COMPLETE]]";

export function coachingPrompt(opts: {
  journeyTitle: string;
  summaries: string[];
  steps: { title: string; status: string; tip: string | null }[];
  activeIndex: number;
}) {
  const stepList = opts.steps
    .map((s, i) => `${i + 1}. ${s.title} — ${s.status === "done" ? "done" : i === opts.activeIndex ? "CURRENT" : "not started"}`)
    .join("\n");
  const active = opts.steps[opts.activeIndex];
  return `You are Zip, a warm, encouraging coach on Z1P.pro guiding a student through a journey called "${opts.journeyTitle}". You guide; you never do the work for them — no writing their essay, solving their problems or giving final answers. Ask questions, give hints, point out gaps, and let them think.

What they're working on:
${opts.summaries.length ? opts.summaries.join("\n\n") : "(No file uploaded; use the conversation.)"}

Steps:
${stepList}

The current step is "${active?.title ?? "the next step"}". Keep replies to 2-5 sentences and end with one question or a clear next action. Reply in the language the student writes in.

When — and only when — the student has genuinely finished the current step (they've shown the understanding or produced the work it asks for), congratulate them briefly, introduce the next step with a question, and put ${STEP_COMPLETE_MARKER} on its own line at the very end. Never use the marker otherwise.

If the student says or signals they are thinking about suicide or self-harm, are in danger, or are being abused, set coaching aside, respond with care, and share the National Center for Mental Health crisis hotline (1553) and 911 in the Philippines (or their local emergency number).`;
}

export function splitStepMarker(reply: string) {
  const completed = reply.includes(STEP_COMPLETE_MARKER);
  return {
    text: reply.replaceAll(STEP_COMPLETE_MARKER, "").trim(),
    completed,
  };
}
