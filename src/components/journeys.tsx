"use client";

import { BookIcon, ChevronRightIcon, PlusIcon } from "@/components/icons";
import { Orb } from "@/components/orb";
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
    <div className="h-full overflow-y-auto px-4 py-8 sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-accent sm:text-5xl">
            Your Journeys
          </h1>
          <p className="mt-1 text-base text-foreground">
            Goals and Plans you&rsquo;ve built with Zip
          </p>
        </div>

        {unfinished && (
          <div className="flex flex-col items-start gap-4 rounded-[20px] border border-card-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-5">
              <Orb size={56} appearance="light" />
              <div>
                <p className="font-display text-base font-semibold text-foreground">
                  Zip noticed you have unfinished work
                </p>
                <p className="text-sm text-muted">
                  &ldquo;{unfinished.title}&rdquo; hasn&rsquo;t reached 100% yet.
                  Would you like to continue where you left off?
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenJourney(unfinished)}
              className="flex shrink-0 items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              Continue Journey
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        )}

        <div>
          <p className="font-display text-lg font-medium text-foreground">
            Active Journeys
          </p>
          <p className="text-sm text-muted">
            Things you&rsquo;re currently working forward
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {activeJourneys.map((journey) => (
            <button
              key={journey.id}
              type="button"
              onClick={() => onOpenJourney(journey)}
              className="flex flex-col gap-5 rounded-[10px] border border-card-border p-4 text-left transition-colors hover:bg-foreground/5"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-input-border text-accent">
                <BookIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-base font-medium text-foreground">
                  {journey.title}
                </p>
                <p className="mt-1.5 text-sm text-muted">
                  {journey.description || "No description yet."}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="self-end text-xs font-medium text-accent">
                  Progress {journey.progress}%
                </span>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-foreground/10">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${journey.progress}%` }}
                  />
                </div>
              </div>
            </button>
          ))}

          <button
            type="button"
            onClick={onStartJourney}
            className="flex flex-col items-center justify-center gap-5 rounded-[10px] border border-dashed border-card-border p-6 text-center"
          >
            <span className="flex flex-col items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-white">
                <PlusIcon className="h-5 w-5" />
              </span>
              <span className="font-display text-base font-medium text-foreground">
                Start Your Journey
              </span>
            </span>
            <span className="text-sm text-muted">
              Tell Zip what you&rsquo;re trying to accomplish and we&rsquo;ll
              help turn it into a Journey.
            </span>
            <span className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white">
              Talk to ZIP
            </span>
          </button>
        </div>

        {journeys.length > 0 && (
          <div className="flex flex-col gap-4 rounded-[10px] border border-card-border/60 px-5 py-6">
            <div>
              <p className="font-display text-base font-semibold text-foreground">
                Recently Created
              </p>
              <p className="text-sm text-muted">
                Journeys created from your recent conversations.
              </p>
            </div>
            <div className="flex flex-col">
              {journeys.slice(0, 5).map((journey, i) => (
                <div key={journey.id}>
                  {i > 0 && <div className="h-px w-full bg-card-border" />}
                  <div className="flex items-center justify-between gap-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-input-border text-accent">
                        <BookIcon className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {journey.title}
                        </p>
                        <p className="text-xs text-muted">
                          {journey.sourceConversationId
                            ? "Crafted from a conversation"
                            : "Created manually"}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenJourney(journey)}
                      className="shrink-0 rounded-[10px] border border-input-border px-4 py-2 text-sm font-medium text-foreground hover:bg-foreground/5"
                    >
                      Open
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
