import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { loadProfile } from "@/lib/life-metrics-data";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await loadProfile(userId);
  if (!payload) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(payload);
}
