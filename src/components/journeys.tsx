"use client";

import { BookIcon, ChevronRightIcon, PlusIcon } from "@/components/icons";
import { Orb } from "@/components/orb";
import type { Journey } from "@/types/journey";

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

        {!loading && journeys.length === 0 && (
          <p className="text-sm text-muted">
            No journeys yet — start one above and it&rsquo;ll show up here.
          </p>
        )}

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
