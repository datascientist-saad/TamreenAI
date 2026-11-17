"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trophy } from "lucide-react";
import { DemoBanner, EmptyState, ExplainList, SafetyBanner } from "@/components/states";
import { ReadinessCard } from "@/features/dashboard/readiness-card";
import { ProposedChangesPanel } from "@/features/plan/proposed-changes";
import { WhoopMetrics } from "@/features/whoop/metrics";
import { greeting, shiftIsoDate, sportLabel } from "@/lib/utils";
import type { WhoopMetricView } from "@/services/wearables/whoop";

const LoadChart = dynamic(() => import("@/features/dashboard/load-chart").then((mod) => mod.LoadChart));

type TodayWorkout = {
  id: string;
  sport: string;
  title: string;
  duration_min: number | null;
  objective: string | null;
  why_text: string | null;
  camera?: boolean;
};

type WeekWorkout = {
  id: string;
  scheduled_date: string;
  sport: string;
  title: string;
  duration_min: number | null;
  status: string;
};

type Score = {
  dimension: string;
  score: number | null;
  explanation: string | null;
};

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

export type HomeDashboardProps = {
  name: string;
  hour: number;
  today: string;
  isDemo: boolean;
  todayWorkouts: TodayWorkout[];
  weekWorkouts: WeekWorkout[];
  readiness: Readiness | null;
  scores: Score[];
  points: Array<{ day: string; load: number }>;
  target: number;
  event: { id: string; event_type: string; name: string; days: number; priority?: string | null } | null;
  events?: Array<{ id: string; event_type: string; name: string; days: number; priority?: string | null }>;
  insight: { id: string; title: string; body: string; factors: unknown; proposed_changes?: unknown } | null;
  conflict: { title: string; explanation: string } | null;
  whoop: { status: string; metrics: WhoopMetricView[] } | null;
};

export function HomeDashboard({
  name,
  hour,
  today,
  isDemo,
  todayWorkouts,
  weekWorkouts,
  readiness,
  scores,
  points,
  target,
  event,
  events = [],
  insight,
  conflict,
  whoop,
}: HomeDashboardProps) {
  const router = useRouter();
  const [pendingInsight, startInsight] = useTransition();
  const [insightDone, setInsightDone] = useState(false);
  const overall = scores.find((score) => score.dimension === "overall");
  const relevant = scores.filter((score) => score.dimension !== "overall" && score.score != null);
  const factors = Array.isArray(insight?.factors) ? insight.factors as Array<{ label: string; detail: string }> : [];
  const activeEvents = events.length ? events : event ? [event] : [];
  const proposed = Array.isArray(insight?.proposed_changes)
    ? (insight.proposed_changes as Array<Record<string, unknown>>).map((row, index) => ({
      id: String(row.id ?? row.workoutId ?? index),
      title: String(row.title ?? "Workout change"),
      fromDate: String(row.fromDate ?? row.from ?? "—"),
      toDate: String(row.toDate ?? row.to ?? "—"),
      fromDurationMin: typeof row.fromDurationMin === "number" ? row.fromDurationMin : null,
      toDurationMin: typeof row.toDurationMin === "number" ? row.toDurationMin : null,
      fromIntensity: row.fromIntensity == null ? null : String(row.fromIntensity),
      toIntensity: row.toIntensity == null ? null : String(row.toIntensity),
      reason: String(row.reason ?? insight?.body ?? "Adaptive schedule change"),
      impact: row.impact == null ? "Updates upcoming sessions only. Completed workouts stay unchanged." : String(row.impact),
      eventGoals: Array.isArray(row.eventGoals) ? row.eventGoals.map(String) : activeEvents.slice(0, 2).map((item) => item.name),
      detail: row.detail == null ? insight?.body ?? null : String(row.detail),
    }))
    : insight
      ? [{
        id: insight.id,
        title: insight.title,
        fromDate: "Current plan",
        toDate: "Adjusted plan",
        reason: insight.body,
        impact: "Applies only after you accept. Completed history is preserved.",
        eventGoals: activeEvents.slice(0, 2).map((item) => item.name),
        detail: factors.map((factor) => `${factor.label}: ${factor.detail}`).join(" "),
      }]
      : [];

  return (
    <main className="mx-auto grid w-full min-w-0 max-w-5xl gap-4 px-4 py-5 *:min-w-0 sm:py-6">
      <header className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
        <div className="min-w-0">
          <p className="eyebrow">Today</p>
          <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">{greeting(name, hour)}</h1>
          <div className="mt-3 flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Link className="btn btn-primary w-full sm:w-auto" href="/plan">Open plan</Link>
            {isDemo ? <DemoBanner /> : null}
          </div>
        </div>
        <ReadinessCard readiness={readiness} />
      </header>

      <WeekStrip today={today} workouts={weekWorkouts} />
      {readiness?.blocked_for_safety ? <SafetyBanner /> : null}

      <section className="grid min-w-0 gap-4">
        <article className="app-card min-w-0 p-4 sm:p-5">
          <h2 className="text-lg font-bold">Today&apos;s training</h2>
          {todayWorkouts.length === 0 ? (
            <EmptyState title="Nothing is scheduled today." body="Today is open. The rest of the week is on your plan." href="/plan" action="Open plan" />
          ) : (
            <ul className="mt-4 grid gap-3">
              {todayWorkouts.map((workout) => (
                <li key={workout.id} className="min-w-0 rounded-2xl border border-line p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`chip sport-${workout.sport}`}>{sportLabel(workout.sport)}</span>
                    <span className="metric text-sm">{workout.duration_min ?? "—"} min</span>
                  </div>
                  <h3 className="mt-2 text-balance text-xl font-bold sm:text-2xl">{workout.title}</h3>
                  <p className="text-sm text-muted">{workout.objective}</p>
                  <p className="mt-2 text-sm">{workout.why_text}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link className="btn btn-primary w-full sm:w-auto" href={`/train/${workout.id}`}>Start workout</Link>
                    {workout.camera ? <Link className="btn btn-ghost w-full sm:w-auto" href="/live">Live camera</Link> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      {whoop ? (
        <article className="app-card min-w-0 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold">WHOOP</h2>
            <Link className="text-sm font-bold text-maroon" href="/more">Manage</Link>
          </div>
          <div className="mt-3">
            <WhoopMetrics metrics={whoop.metrics} compact />
          </div>
        </article>
      ) : null}

      <section className="grid min-w-0 gap-4 md:grid-cols-3">
        <article className="app-card min-w-0 p-4 sm:p-5">
          <p className="eyebrow">Tamreen performance score</p>
          <p className="metric mt-2 text-5xl font-bold sm:text-6xl">{overall?.score ?? "—"}</p>
          <p className="text-sm text-muted">{overall?.explanation ?? "The score appears after enough logged training or reported baselines."}</p>
          <ul className="mt-3 grid gap-2">
            {relevant.map((score) => (
              <li key={score.dimension} className="min-w-0">
                <Link className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-paper px-3 py-2" href={`/progress/${score.dimension}`}>
                  <span className="capitalize">{score.dimension}</span>
                  <span className="metric shrink-0 font-bold">{score.score}</span>
                </Link>
              </li>
            ))}
          </ul>
        </article>
        <article className="app-card min-w-0 p-4 sm:p-5 md:col-span-2">
          <h2 className="font-bold">Weekly load vs recommended</h2>
          <p className="text-sm text-muted">Bars use completed-session load. The dashed line is the daily share of the recommended week.</p>
          {points.length ? <LoadChart points={points} target={target} /> : <p className="mt-6 text-sm text-muted">No completed sessions in the last 7 days.</p>}
        </article>
      </section>

      {activeEvents.length ? (
        <section className="grid min-w-0 gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-bold"><Trophy size={18} strokeWidth={1.75} aria-hidden /> Active events</h2>
            <Link className="text-sm font-bold text-maroon" href="/events">All events</Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {activeEvents.slice(0, 4).map((item) => (
              <article key={item.id} className="app-card min-w-0 p-4 sm:p-5">
                <p className="eyebrow">{item.priority ? `${item.priority} · ${item.event_type}` : item.event_type}</p>
                <h3 className="text-balance text-xl font-extrabold sm:text-2xl">{item.name}</h3>
                <p className="metric text-lg">{item.days} days remaining</p>
                <Link className="btn btn-ghost mt-3 w-full sm:w-auto" href={`/events/${item.id}`}>Event prep</Link>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {insight && !insightDone ? (
        <article className="app-card min-w-0 border-l-4 border-l-maroon p-4 sm:p-5">
          <p className="eyebrow">Why Tamreen is saying this</p>
          <h2 className="mt-2 text-balance text-xl font-bold">{insight.title}</h2>
          <ExplainList factors={factors} />
          <div className="mt-4">
            <ProposedChangesPanel
              proposalId={insight.id}
              explanation={insight.body}
              changes={proposed}
              onAcceptAll={async (id) => {
                startInsight(async () => {
                  const { respondToRecommendation } = await import("@/server/actions");
                  await respondToRecommendation(id, true);
                  setInsightDone(true);
                  router.refresh();
                });
              }}
              onRejectAll={async (id) => {
                startInsight(async () => {
                  const { respondToRecommendation } = await import("@/server/actions");
                  await respondToRecommendation(id, false);
                  setInsightDone(true);
                  router.refresh();
                });
              }}
            />
            {pendingInsight ? <p className="sr-only" role="status">Saving recommendation response</p> : null}
          </div>
        </article>
      ) : null}

      {conflict ? (
        <article className="app-card min-w-0 p-4 sm:p-5">
          <p className="eyebrow text-live">{conflict.title}</p>
          <p className="mt-2">{conflict.explanation}</p>
          <Link className="btn btn-primary mt-4 w-full sm:w-auto" href="/conflicts">Optimize schedule</Link>
        </article>
      ) : null}
    </main>
  );
}

function WeekStrip({
  today,
  workouts,
}: {
  today: string;
  workouts: WeekWorkout[];
}) {
  const days = Array.from({ length: 7 }, (_, index) => shiftIsoDate(today, index));
  return (
    <section className="app-card min-w-0 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold">This week</h2>
        <Link className="text-sm font-bold text-maroon" href="/plan">Full plan</Link>
      </div>
      <div className="-mx-4 mt-3 flex snap-x snap-proximity gap-2 overflow-x-auto overscroll-x-contain px-4 pb-1 sm:mx-0 sm:px-0">
        {days.map((date) => {
          const rows = workouts.filter((workout) => workout.scheduled_date === date);
          const first = rows[0];
          const label = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
          return (
            <Link
              key={date}
              href={rows.length > 1 ? `/plan#${date}` : first ? `/train/${first.id}` : "/plan"}
              className={`w-36 shrink-0 snap-start rounded-2xl border px-3 py-3 sm:w-40 ${date === today ? "border-maroon bg-maroon text-white" : "border-line bg-paper"}`}
            >
              <span className="text-xs font-bold uppercase tracking-wide">{date === today ? "Today" : label}</span>
              <span className="mt-1 line-clamp-3 block min-h-10 font-bold leading-tight">{rows.length ? rows.map((row) => row.title).join(" + ") : "Rest"}</span>
              <span className={`mt-1 block text-xs ${date === today ? "text-white/80" : "text-muted"}`}>
                {rows.length ? `${rows.reduce((sum, row) => sum + (row.duration_min ?? 0), 0)} min` : "Open plan"}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
