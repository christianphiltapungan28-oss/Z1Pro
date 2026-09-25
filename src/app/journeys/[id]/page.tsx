import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { JourneyFlow } from "@/components/journey-flow";

export const metadata: Metadata = {
  title: "Journey — Z1P.pro",
};

export default async function JourneyPage({ params }: PageProps<"/journeys/[id]">) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/journeys/${id}`)}`);
  }
  return <JourneyFlow journeyId={id} />;
}
