"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { KitProgress, RacePrepSnapshot } from "@/services/events/race-prep";

export type RacePrepCardModel = {
  eventId: string;
  eventName: string;
  countdownLabel: string;
  countdownAnnounce?: string;
  startLabel: string | null;
  startTimeLabel?: string | null;
  timeZoneDisplay?: string | null;
  eventDateLabel?: string;
  needsStartTime?: boolean;
  kitProgress: KitProgress;
  phase: RacePrepSnapshot["phase"];
  imageUrl?: string | null;
  from?: string;
};

/**
 * Compact upcoming-race row for Today. Whole row opens Race Prep.
 * Shows only: name, countdown, local start, kit progress.
 */
export function RacePrepCard({
  model,
}: {
  model: RacePrepCardModel;
  /** @deprecated Featured treatment removed — keep prop for callers. */
  featured?: boolean;
}) {
  const href = `/events/${model.eventId}/prep${model.from ? `?from=${encodeURIComponent(model.from)}` : ""}`;
  const startLine = model.needsStartTime
    ? `${model.eventDateLabel ?? "Race day"} · Add start time`
    : model.startLabel
      ?? (model.startTimeLabel
        ? (model.timeZoneDisplay ? `${model.startTimeLabel} · ${model.timeZoneDisplay}` : model.startTimeLabel)
        : null);
  const announce = model.countdownAnnounce ?? model.countdownLabel;

  return (
    <Link
      href={href}
      className="app-card flex min-h-14 items-center gap-3 px-3 py-3 transition-colors hover:bg-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon"
      aria-label={`${model.eventName}. ${announce}. ${startLine ?? ""}. ${model.kitProgress.label}. Open Race Prep.`}
    >
      {model.imageUrl ? (
        <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-elevated">
          <Image
            src={model.imageUrl}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 object-cover"
          />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-sm font-semibold text-ink">{model.eventName}</span>
          <span className="shrink-0 text-sm font-semibold text-ink" aria-hidden="true">
            {model.countdownLabel}
          </span>
        </span>
        {startLine ? (
          <span className="mt-0.5 flex items-baseline justify-between gap-3">
            <span className="truncate text-sm text-muted">{startLine}</span>
            <ChevronRight size={16} strokeWidth={1.75} className="shrink-0 text-muted" aria-hidden />
          </span>
        ) : (
          <span className="mt-0.5 flex justify-end">
            <ChevronRight size={16} strokeWidth={1.75} className="shrink-0 text-muted" aria-hidden />
          </span>
        )}
        <span className="mt-1 block text-sm text-muted">{model.kitProgress.label}</span>
      </span>
    </Link>
  );
}
