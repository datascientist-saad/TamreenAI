import Link from "next/link";
import { CheckCircle2, ChevronRight, Circle } from "lucide-react";
import { SportIcon } from "@/components/ui/sport-icon";
import { cn, formatDuration, intensityLabel, sportLabel } from "@/lib/utils";

export function WorkoutCard({
  id,
  sport,
  title,
  durationMin,
  intensity,
  status,
  objective,
  href,
  actionLabel,
  compact = false,
}: {
  id: string;
  sport: string;
  title: string;
  durationMin?: number | null;
  intensity?: string | null;
  status?: string | null;
  objective?: string | null;
  href?: string;
  actionLabel?: string;
  compact?: boolean;
}) {
  const destination = href ?? `/train/${id}`;
  const done = status === "completed";
  const statusClass = status ? `status-${status}` : "status-planned";

  return (
    <article className={cn("app-card min-w-0 overflow-hidden", compact ? "p-3" : "p-3.5 sm:p-4")}>
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full", done ? "bg-success-soft text-success" : "bg-maroon-soft text-maroon")}>
          {done ? <CheckCircle2 size={18} strokeWidth={1.75} aria-hidden /> : <SportIcon sport={sport} size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`chip sport-${sport}`}>{sportLabel(sport)}</span>
            {status ? <span className={cn("chip", statusClass)}>{status}</span> : null}
          </div>
          <h3 className={cn("mt-1.5 font-bold leading-snug", compact ? "text-base" : "text-lg")}>{title}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted">
            {durationMin != null ? <span className="metric">{formatDuration(durationMin)}</span> : null}
            {intensity ? <span>· {intensityLabel(intensity)}</span> : null}
          </p>
          {!compact && objective ? <p className="mt-1 line-clamp-2 text-sm text-muted">{objective}</p> : null}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Link className={cn("btn w-full", done ? "btn-ghost" : "btn-primary")} href={destination}>
          {actionLabel ?? (done ? "View workout" : "Start")}
          <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
        </Link>
      </div>
    </article>
  );
}

export function WorkoutRow({
  id,
  sport,
  title,
  durationMin,
  status,
  href,
}: {
  id: string;
  sport: string;
  title: string;
  durationMin?: number | null;
  status?: string | null;
  href?: string;
}) {
  const done = status === "completed";
  return (
    <Link
      href={href ?? `/train/${id}`}
      className="flex min-h-12 items-center gap-3 rounded-[var(--radius-md)] px-1 py-2 transition-colors hover:bg-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon"
    >
      {done ? (
        <CheckCircle2 size={18} className="shrink-0 text-success" strokeWidth={1.75} aria-hidden />
      ) : (
        <Circle size={18} className="shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
      )}
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-maroon-soft text-maroon">
        <SportIcon sport={sport} size={14} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{title}</span>
        <span className="caption">{sportLabel(sport)}{durationMin != null ? ` · ${formatDuration(durationMin)}` : ""}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
    </Link>
  );
}
