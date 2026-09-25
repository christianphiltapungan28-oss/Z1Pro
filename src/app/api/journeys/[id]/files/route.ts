import { NextResponse } from "next/server";
import { count, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { journeyFiles, journeyMessages, journeySteps } from "@/db/schema";
import {
  ACCEPTED_TYPES,
  acceptLabel,
  fileContent,
  MAX_FILE_BYTES,
  planFromContent,
  storeOriginal,
  summariseExtraFile,
} from "@/lib/journey-flow";
import { getOwnedJourney, loadFlow, savePlan } from "@/lib/journey-flow-data";
import { rateLimit } from "@/lib/rate-limit";
import { isOverDailyBudget } from "@/lib/usage-guard";

const MAX_FILES_PER_JOURNEY = 10;

function safeName(name: string) {
  return name.replace(/[^\w.-]+/g, "_").slice(-80) || "file";
}

/**
 * Uploads a file to a journey. The first file is analysed into the step
 * breakdown; later files are summarised and added as coaching context.
 */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/journeys/[id]/files">
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await rateLimit(`journey-files:${userId}`, 10, 60 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "You've uploaded a lot of files this hour. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const { id } = await ctx.params;
  const journey = await getOwnedJourney(id, userId);
  if (!journey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!process.env.OPENAI_API_KEY || (await isOverDailyBudget("chatTokens"))) {
    return NextResponse.json(
      { error: "File analysis is temporarily unavailable. Please try again later." },
      { status: 503 }
    );
  }

  // Reject oversized uploads before reading the body.
  const declared = Number(request.headers.get("content-length"));
  if (declared > MAX_FILE_BYTES + 64 * 1024) {
    return NextResponse.json({ error: `Please upload a ${acceptLabel()}.` }, { status: 413 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  }
  const mimeType = file.type || (file.name.endsWith(".md") ? "text/markdown" : "");
  if (!ACCEPTED_TYPES[mimeType]) {
    return NextResponse.json(
      { error: `That file type isn't supported. Please upload a ${acceptLabel()}.` },
      { status: 415 }
    );
  }
  if (file.size === 0 || file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: `Please upload a ${acceptLabel()}.` }, { status: 413 });
  }

  const [{ files: fileCount }] = await db
    .select({ files: count() })
    .from(journeyFiles)
    .where(eq(journeyFiles.journeyId, id));
  if (fileCount >= MAX_FILES_PER_JOURNEY) {
    return NextResponse.json(
      { error: `A journey can have up to ${MAX_FILES_PER_JOURNEY} files.` },
      { status: 400 }
    );
  }

  const [{ steps: stepCount }] = await db
    .select({ steps: count() })
    .from(journeySteps)
    .where(eq(journeySteps.journeyId, id));

  const bytes = await file.arrayBuffer();
  const content = fileContent(file.name, mimeType, bytes);

  try {
    if (stepCount === 0) {
      const plan = await planFromContent(journey.title, [content]);
      if (!plan) {
        return NextResponse.json(
          { error: "I couldn't find a task in that file. Try another file or describe what you need." },
          { status: 422 }
        );
      }
      const [row] = await db
        .insert(journeyFiles)
        .values({
          journeyId: id,
          userId,
          fileName: file.name.slice(0, 200),
          mimeType,
          sizeBytes: file.size,
          summary: plan.summary,
        })
        .returning({ id: journeyFiles.id });
      await savePlan(id, userId, plan);
      await attachStoredOriginal(row.id, userId, id, file.name, bytes, mimeType);
    } else {
      const extra = await summariseExtraFile(content);
      const [row] = await db
        .insert(journeyFiles)
        .values({
          journeyId: id,
          userId,
          fileName: file.name.slice(0, 200),
          mimeType,
          sizeBytes: file.size,
          summary: extra.summary,
        })
        .returning({ id: journeyFiles.id });
      await db
        .insert(journeyMessages)
        .values({ journeyId: id, userId, role: "assistant", content: extra.reply });
      await attachStoredOriginal(row.id, userId, id, file.name, bytes, mimeType);
    }
  } catch (err) {
    console.error("Journey file analysis failed", err);
    return NextResponse.json(
      { error: "Couldn't analyse that file. Please try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ready: true, ...(await loadFlow(id)) });
}

async function attachStoredOriginal(
  fileId: string,
  userId: string,
  journeyId: string,
  name: string,
  bytes: ArrayBuffer,
  mimeType: string
) {
  const path = await storeOriginal(`${userId}/${journeyId}/${fileId}-${safeName(name)}`, bytes, mimeType);
  if (path) {
    await db.update(journeyFiles).set({ storagePath: path }).where(eq(journeyFiles.id, fileId));
  }
}
