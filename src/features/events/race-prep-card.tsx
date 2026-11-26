"use client";

import Link from "next/link";
import { CalendarDays, CheckCircle2, ChevronRight, Flag, Timer } from "lucide-react";
import type { RacePrepSnapshot } from "@/services/events/race-prep";

export type RacePrepCardModel = {
  eventId: string;
  eventName: string;
  cardTitle: string;
  cardSubtitle: string;
  countdownLabel: string;
  startLabel: string | null;
  checklistProgress: { done: number; total: number };
  phase: RacePrepSnapshot["phase"];
  from?: string;
};

export function RacePrepCard({
  model,
  featured = false,
}: {
  model: RacePrepCardModel;
  featured?: boolean;
}) {
  const href = `/events/${model.eventId}/prep${model.from ? `?from=${encodeURIComponent(model.from)}` : ""}`;
  const progress = model.checklistProgress.total
    ? Math.round((model.checklistProgress.done / model.checklistProgress.total) * 100)
    : 0;

  return (
    <article
      className={`app-card grid gap-3 border-l-2 border-l-maroon p-4 ${featured ? "ring-1 ring-maroon/40" : ""}`}
      aria-label={`${model.cardTitle} for ${model.eventName}`}
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-maroon-soft text-maroon">
          {model.phase === "race_day" ? (
            <Flag size={18} strokeWidth={1.75} aria-hidden />
          ) : model.phase === "fuel" ? (
            <CalendarDays size={18} strokeWidth={1.75} aria-hidden />
          ) : (
            <Timer size={18} strokeWidth={1.75} aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{model.cardTitle}</p>
          <h2 className="mt-0.5 text-lg font-bold leading-snug">{model.eventName}</h2>
          <p className="caption mt-1">
            {model.countdownLabel}
            {model.startLabel ? ` · ${model.startLabel}` : ""}
          </p>
          <p className="mt-2 text-sm text-muted">{model.cardSubtitle}</p>
        </div>
      </div>

      <div className="grid gap-1.5" aria-label="Checklist progress">
        <div className="flex items-center justify-between gap-2 text-xs font-semibold text-muted">
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 size={14} strokeWidth={1.75} className="text-maroon" aria-hidden />
            {model.checklistProgress.done}/{model.checklistProgress.total} tasks
          </span>
          <span className="metric">{progress}%</span>
        </div>
        <div className="progress-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>

      <Link className="btn btn-primary" href={href}>
        Open Race Prep
        <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
      </Link>
    </article>
  );
}
