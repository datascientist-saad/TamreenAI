import Link from "next/link";
import { Activity, Battery, Brain, HeartPulse, Moon } from "lucide-react";
import { readinessTone, recommendationLabel } from "@/lib/fitness";
import { cn } from "@/lib/utils";

type Readiness = {
  blocked_for_safety?: boolean | null;
  overall?: number | null;
  explanation?: string | null;
  sleep?: number | null;
  recovery?: number | null;
  recent_load?: number | null;
  muscle_fatigue?: number | null;
  cardio_fatigue?: number | null;
  train_recommendation?: string | null;
  scored_on?: string | null;
};

export function ReadinessCard({
  readiness,
  compact = false,
}: {
  readiness: Readiness | null;
  compact?: boolean;
}) {
  const score = readiness?.overall == null ? null : Number(readiness.overall);
  const tone = readinessTone(score);
  const label = recommendationLabel(readiness?.train_recommendation ?? (score == null ? null : "train_as_planned"));
  const toneClass =
    tone === "good" ? "text-success"
    : tone === "ok" ? "text-warning"
    : tone === "low" ? "text-danger"
    : "text-maroon";

  return (
    <article className="app-card min-w-0 p-4">
      <div className={cn("grid gap-4", !compact && "sm:grid-cols-[auto_1fr] sm:items-center")}>
        <ReadinessRing score={score} tone={tone} />
        <div className="min-w-0">
          <p className="eyebrow">Today&apos;s readiness</p>
          <p className={cn("mt-1 text-2xl font-bold tracking-tight", toneClass)}>
            {score == null ? "Incomplete" : `${Math.round(score)}/100`}
          </p>
          <p className="mt-0.5 text-sm font-semibold">{label}</p>
          <p className="mt-2 text-sm text-muted line-clamp-3">
            {readiness?.explanation ?? "Log a recovery check-in to score readiness. Tamreen will not invent one."}
          </p>
          {readiness?.scored_on ? <p className="caption mt-2">Updated {readiness.scored_on}</p> : null}
        </div>
      </div>

      {!compact ? (
        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Metric icon={Moon} label="Sleep" value={readiness?.sleep} />
          <Metric icon={Battery} label="Recovery" value={readiness?.recovery} />
          <Metric icon={Activity} label="Load" value={readiness?.recent_load} />
          <Metric icon={HeartPulse} label="Muscle" value={readiness?.muscle_fatigue} />
          <Metric icon={Brain} label="Cardio" value={readiness?.cardio_fatigue} className="col-span-2 sm:col-span-1" />
        </dl>
      ) : null}

      {score == null ? (
        <Link className="btn btn-primary mt-4 w-full" href="/recovery?tab=checkin">Complete a check-in</Link>
      ) : (
        <Link className="btn btn-ghost mt-4 w-full" href="/recovery">Recovery details</Link>
      )}
    </article>
  );
}

function ReadinessRing({ score, tone }: { score: number | null; tone: string }) {
  const value = score == null ? 0 : Math.max(0, Math.min(100, score));
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const stroke =
    tone === "good" ? "var(--success)"
    : tone === "ok" ? "var(--warning)"
    : tone === "low" ? "var(--danger)"
    : "var(--maroon)";

  return (
    <div
      className="relative mx-auto grid h-24 w-24 place-items-center"
      role="img"
      aria-label={score == null ? "Readiness unavailable" : `Readiness ${Math.round(score)} out of 100`}
    >
      <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--line)" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={score == null ? circumference : offset}
        />
      </svg>
      <p className="metric absolute text-2xl font-bold">{score == null ? "—" : Math.round(score)}</p>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: typeof Moon;
  label: string;
  value: number | null | undefined;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 rounded-[var(--radius-sm)] bg-elevated px-2.5 py-2", className)}>
      <dt className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
        <Icon size={12} strokeWidth={1.75} aria-hidden />
        {label}
      </dt>
      <dd className="metric text-lg font-bold">{value ?? "—"}</dd>
    </div>
  );
}
