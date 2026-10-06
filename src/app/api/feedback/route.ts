import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { concerns } from "@/db/schema";
import { rateLimit } from "@/lib/rate-limit";

const KINDS = { bug: "Bug", idea: "Idea", other: "Feedback" } as const;
type Kind = keyof typeof KINDS;

const MAX_MESSAGE = 4000;

/**
 * Beta feedback from inside the app. Saved as a ticket in `concerns`, which
 * the FlowSmart support site reads directly, with the screen and browser it
 * was sent from so a bug can be reproduced.
 * POST { kind: "bug" | "idea" | "other", message, page } → { reference }
 */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limit = await rateLimit(`feedback:${userId}`, 10, 60 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "You've sent a lot of feedback this hour. Thank you! Try again a little later." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const kind: Kind = body?.kind in KINDS ? body.kind : "other";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const page = typeof body?.page === "string" ? body.page.slice(0, 200) : "";
  if (!message) {
    return NextResponse.json(
      { error: "Write a little about what happened or what you'd like." },
      { status: 400 },
    );
  }
  if (message.length > MAX_MESSAGE) {
    return NextResponse.json(
      { error: `Keep it under ${MAX_MESSAGE} characters.` },
      { status: 400 },
    );
  }

  const reference = `FB-${randomBytes(3).toString("hex").toUpperCase()}`;
  const firstLine = message.split("\n")[0].slice(0, 80);
  const context = [
    page && `Screen: ${page}`,
    `Browser: ${(request.headers.get("user-agent") ?? "unknown").slice(0, 300)}`,
  ]
    .filter(Boolean)
    .join("\n");

  await db.insert(concerns).values({
    userId,
    reference,
    subject: `[Beta ${KINDS[kind]}] ${firstLine}`,
    body: `${message}\n\n---\n${context}`,
    category: `beta-${kind}`,
    priority: kind === "bug" ? "high" : "normal",
  });

  return NextResponse.json({ reference });
}
