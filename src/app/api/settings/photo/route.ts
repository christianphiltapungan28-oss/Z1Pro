import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { rateLimit } from "@/lib/rate-limit";

// The browser shrinks photos to a 256×256 JPEG (typically 20–40 KB) before
// sending, so they can live on the user row without a storage service.
const PREFIX = "data:image/jpeg;base64,";
const MAX_BYTES = 150 * 1024;

/** POST { image: "data:image/jpeg;base64,…" } sets the profile photo. */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await rateLimit(`settings:photo:${userId}`, 10, 60 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many photo changes. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES * 2) {
    return NextResponse.json({ error: "That image is too large." }, { status: 413 });
  }

  const body = await request.json().catch(() => ({}));
  const image = typeof body?.image === "string" ? body.image : "";
  if (!image.startsWith(PREFIX)) {
    return NextResponse.json({ error: "Upload a JPG or PNG image." }, { status: 400 });
  }
  const b64 = image.slice(PREFIX.length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) {
    return NextResponse.json({ error: "That image couldn't be read." }, { status: 400 });
  }
  const bytes = Buffer.from(b64, "base64");
  // Real JPEG data only (starts with the JPEG marker), within the size cap.
  if (bytes.length > MAX_BYTES || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    return NextResponse.json({ error: "That image couldn't be read." }, { status: 400 });
  }

  await db
    .update(users)
    .set({ avatarUrl: image, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return NextResponse.json({ image });
}
