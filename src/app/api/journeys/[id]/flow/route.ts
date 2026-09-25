import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isMissingTable } from "@/lib/db-errors";
import { getOwnedJourney, loadFlow } from "@/lib/journey-flow-data";

/** The journey page's full state: steps, files and coaching messages. */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/journeys/[id]/flow">
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const journey = await getOwnedJourney(id, userId);
  if (!journey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    return NextResponse.json({ ready: true, ...(await loadFlow(id)) });
  } catch (err) {
    // The flow tables come from scripts/add-journey-flow.sql.
    if (isMissingTable(err)) {
      return NextResponse.json({
        ready: false,
        journey: {
          id: journey.id,
          title: journey.title,
          description: journey.description,
          progress: journey.progress,
          completedAt: journey.completedAt,
          createdAt: journey.createdAt,
          sourceConversationId: journey.sourceConversationId,
        },
        steps: [],
        files: [],
        messages: [],
      });
    }
    throw err;
  }
}
