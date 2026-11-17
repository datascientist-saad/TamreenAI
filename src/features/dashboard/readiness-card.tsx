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

  return (
    <article className={cn("app-card min-w-0 overflow-hidden", compact ? "p-0" : "p-0")}>
      <div
        className={cn(
          "grid gap-4 bg-gradient-to-br from-maroon-deep to-maroon p-4 text-white sm:grid-cols-[auto_1fr] sm:items-center sm:p-5",
          tone === "good" && "from-[#1f4d3a] to-[#2f6b4f]",
          tone === "ok" && "from-[#5c3d12] to-[#8a6418]",
          tone === "low" && "from-[#5a1414] to-live",
          tone === "none" && "from-maroon-deep to-maroon",
        )}
      >
        <ReadinessRing score={score} />
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/70">Daily readiness</p>
          <p className="mt-1 text-2xl font-extrabold">{score == null ? "Incomplete data" : `${Math.round(score)}/100`}</p>
          <p className="mt-1 text-sm font-semibold text-white/90">{label}</p>
          <p className="mt-2 text-sm text-white/80">
            {readiness?.explanation ?? "Log a recovery check-in to score readiness. Tamreen will not invent one."}
          </p>
          {readiness?.scored_on ? <p className="mt-2 text-xs text-white/65">Updated {readiness.scored_on}</p> : null}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-5 sm:p-4">
        <Metric icon={Moon} label="Sleep" value={readiness?.sleep} />
        <Metric icon={Battery} label="Recovery" value={readiness?.recovery} />
        <Metric icon={Activity} label="Load" value={readiness?.recent_load} />
        <Metric icon={HeartPulse} label="Muscle" value={readiness?.muscle_fatigue} />
        <Metric icon={Brain} label="Cardio" value={readiness?.cardio_fatigue} className="col-span-2 sm:col-span-1" />
      </dl>
      <div className="border-t border-line px-3 pb-3 sm:px-4 sm:pb-4">
        <Link className="btn btn-ghost w-full" href="/recovery">Open body check-in</Link>
      </div>
    </article>
  );
}

function ReadinessRing({ score }: { score: number | null }) {
  const value = score == null ? 0 : Math.max(0, Math.min(100, score));
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className="relative mx-auto grid h-24 w-24 place-items-center sm:h-28 sm:w-28" role="img" aria-label={score == null ? "Readiness unavailable" : `Readiness ${Math.round(score)} out of 100`}>
      <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="10" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="white"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={score == null ? circumference : offset}
        />
      </svg>
      <p className="metric absolute text-3xl font-extrabold">{score == null ? "—" : Math.round(score)}</p>
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
    <div className={cn("min-w-0 rounded-xl bg-paper px-3 py-2", className)}>
      <dt className="flex items-center gap-1.5 text-xs leading-tight text-muted">
        <Icon size={14} strokeWidth={1.75} aria-hidden />
        {label}
      </dt>
      <dd className="metric text-xl font-bold">{value ?? "—"}</dd>
    </div>
  );
}
