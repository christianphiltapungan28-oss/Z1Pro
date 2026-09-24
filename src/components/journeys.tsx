"use client";

import { DesignOrb } from "@/components/design-orb";
import type { Journey } from "@/types/journey";

// The empty-state illustration is made of separate vector layers from the
// Figma design, each placed by its inset (top, right, bottom, left) within
// the 309×299 artwork frame, listed back to front.
const EMPTY_ILLUSTRATION_LAYERS: [file: string, inset: string][] = [
  ["vector-0", "9.22% 18.12% 9.25% 18.09%"],
  ["vector-1", "9.22% 38.34% 72.32% 39.19%"],
  ["vector-2", "67.85% 18.12% 9.25% 18.09%"],
  ["vector-3", "9.22% 38.54% 72.32% 39.39%"],
  ["vector-4", "27.57% 41.54% 63.53% 40.88%"],
  ["vector-5", "45.33% 32.47% 51.49% 63.32%"],
  ["vector-7", "45.33% 63.35% 51.49% 32.44%"],
  ["vector-8", "58.67% 49.94% 39.1% 42.4%"],
  ["vector-9", "43.07% 52.15% 53.98% 42.05%"],
  ["vector-10", "43.07% 42.08% 53.98% 52.12%"],
  ["vector-11", "48.38% 54.68% 48.73% 40%"],
  ["vector-12", "48.38% 40.03% 48.73% 54.65%"],
  ["vector-13", "46.54% 49.34% 47.89% 48.46%"],
  ["vector-14", "52.55% 43.76% 44.22% 51.43%"],
];

function JourneysEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center overflow-y-auto px-4 py-8">
      <div className="flex w-full max-w-[309px] flex-col items-center">
        <div aria-hidden="true" className="relative h-[299px] w-[309px] shrink-0 overflow-hidden">
          {EMPTY_ILLUSTRATION_LAYERS.map(([file, inset]) => (
            <div key={file} className="absolute" style={{ inset }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/journeys-empty/${file}.svg`}
                alt=""
                className="absolute inset-0 block size-full max-w-none"
              />
            </div>
          ))}
        </div>
        <p className="text-center text-xl text-foreground sm:whitespace-nowrap">
          No Journeys Here yet, Create one
        </p>
      </div>

      <button
        type="button"
        onClick={onCreate}
        className="mt-[72px] flex h-11 w-[225px] shrink-0 items-center justify-center gap-2.5 rounded-[30px] bg-accent-muted p-2.5 text-xl font-medium text-white transition-opacity hover:opacity-90"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/journeys-empty/sparkle.svg"
          alt=""
          width={24}
          height={24}
          className="size-6 shrink-0"
        />
        Create Journey
      </button>
    </div>
  );
}

export function Journeys({
  journeys,
  loading,
  onStartJourney,
  onOpenJourney,
}: {
  journeys: Journey[];
  loading: boolean;
  onStartJourney: () => void;
  onOpenJourney: (journey: Journey) => void;
}) {
  const activeJourneys = journeys.filter((j) => j.progress < 100);
  const unfinished = activeJourneys[0];

  if (!loading && journeys.length === 0) {
    return <JourneysEmptyState onCreate={onStartJourney} />;
  }

  return (
    <div className="h-full overflow-y-auto px-4 pt-8 pb-10 sm:pl-[47px] sm:pr-8 sm:pt-[50px]">
      <div className="flex max-w-[1069px] flex-col gap-9">
        <div className="max-w-[712px]">
          <h1 className="font-display text-4xl font-bold text-accent sm:text-5xl">
            Your Journeys
          </h1>
          <p className="text-lg text-foreground">
            Goals and Plans you&rsquo;ve built with Zip
          </p>
        </div>

        {unfinished && (
          <div className="flex flex-col items-start gap-4 rounded-[20px] border border-card-border pt-[15px] pr-2.5 pb-2.5 pl-5 sm:min-h-[113px] sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:pr-[31px]">
            <div className="flex items-center gap-5">
              <DesignOrb width={60.5} />
              <div className="flex flex-col gap-1.5 text-foreground">
                <p className="text-lg font-bold">
                  Zip noticed you have unfinished Work
                </p>
                <p className="text-base">
                  Your &ldquo;{unfinished.title}&rdquo; Journey hasn&rsquo;t
                  reached 100% yet.
                  <br className="hidden sm:inline" /> Would you like to
                  continue where you left off?
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenJourney(unfinished)}
              className="flex h-11 w-[198px] shrink-0 items-center justify-center gap-2.5 rounded-[30px] bg-accent p-2.5 text-base font-bold text-white transition-opacity hover:opacity-90"
            >
              Continue Journey
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/ui/arrow-right.svg" alt="" width={12.6088} height={11.8471} />
            </button>
          </div>
        )}

        <div className="flex flex-col gap-[17px]">
          <div>
            <p className="text-lg font-medium text-foreground">
              Active Journeys
            </p>
            <p className="text-sm text-secondary">
              Things you&rsquo;re currently working forward
            </p>
          </div>

          <div className="grid grid-cols-1 gap-x-[19px] sm:grid-cols-2 lg:grid-cols-3">
            {activeJourneys.map((journey) => (
              <div key={journey.id} className="py-2.5">
                <button
                  type="button"
                  onClick={() => onOpenJourney(journey)}
                  className="flex h-[231px] w-full flex-col justify-center gap-5 rounded-[10px] border border-card-border bg-background p-5 text-left transition-colors hover:bg-foreground/5"
                >
                  <JourneyIconBox />
                  <span className="flex w-full flex-col gap-2.5 text-base">
                    <span className="truncate font-medium text-foreground">
                      {journey.title}
                    </span>
                    <span className="line-clamp-2 leading-5 text-secondary">
                      {journey.description || "No description yet."}
                    </span>
                  </span>
                  <span className="flex w-full flex-col gap-[5px]">
                    <span className="self-end text-xs font-medium leading-5 text-accent">
                      Progress {journey.progress}%
                    </span>
                    <span className="block h-[11px] w-full overflow-hidden rounded-[10px] bg-track">
                      <span
                        className="block h-full rounded-[10px] bg-accent"
                        style={{ width: `${journey.progress}%` }}
                      />
                    </span>
                  </span>
                </button>
              </div>
            ))}

            <div className="py-2.5">
              <button
                type="button"
                onClick={onStartJourney}
                className="flex h-[233px] w-full flex-col items-center justify-center gap-[15px] rounded-[10px] border border-dashed border-card-border text-center"
              >
                <span className="flex flex-col items-center gap-5">
                  <span className="flex flex-col items-center gap-5">
                    <span className="flex h-[43.25px] w-[42.5px] items-center justify-center rounded-full bg-accent text-[37px] font-medium leading-none text-white">
                      +
                    </span>
                    <span className="text-base font-medium leading-5 text-foreground">
                      Start Your Journey
                    </span>
                  </span>
                  <span className="w-[263px] text-sm leading-5 text-secondary">
                    Tell Zip what you&rsquo;re trying to accomplish and
                    we&rsquo;ll help turn it into a Journey.
                  </span>
                </span>
                <span className="w-[149px] rounded-[30px] bg-accent p-2.5 text-sm font-bold text-white">
                  Talk to ZIP
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex max-w-[722px] flex-col gap-[15px] rounded-[10px] border border-card-border/60 bg-background px-5 pt-[30px] pb-2.5">
          <div>
            <p className="text-base font-bold text-foreground">
              Recently Created
            </p>
            <p className="text-sm leading-5 text-secondary">
              Journeys created from your recent conversations.
            </p>
          </div>
          <div className="flex flex-col">
            {journeys.slice(0, 5).map((journey, i) => (
              <div key={journey.id}>
                {i > 0 && <div className="h-px w-full bg-track" />}
                <div className="flex items-center justify-between gap-4 py-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <JourneyIconBox />
                    <div className="min-w-0 font-medium">
                      <p className="truncate text-base text-foreground">
                        {journey.title}
                      </p>
                      <p className="text-xs leading-5 text-secondary">
                        {journey.sourceConversationId
                          ? "Crafted From Zip AI"
                          : "Created manually"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenJourney(journey)}
                    className="w-[68px] shrink-0 rounded-[10px] border border-input-border p-2.5 text-sm font-medium leading-5 text-foreground hover:bg-foreground/5"
                  >
                    Open
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function JourneyIconBox() {
  return (
    <span className="flex shrink-0 items-center self-start rounded-[10px] border border-input-border bg-background p-2.5">
      <span className="flex h-6 w-6 items-start justify-center pt-[0.5px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ui/journey-book.svg" alt="" width={22} height={19.4717} />
      </span>
    </span>
  );
}
