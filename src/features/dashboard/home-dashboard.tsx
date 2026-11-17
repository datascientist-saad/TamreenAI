"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Bell,
  CalendarDays,
  ClipboardCheck,
  Flag,
  Plus,
  Sparkles,
} from "lucide-react";
import { DemoBanner, SafetyBanner } from "@/components/states";
import { EmptyState } from "@/components/ui/empty-state";
import { InsightCard } from "@/components/ui/insight-card";
import { ProgressIndicator } from "@/components/ui/progress-indicator";
import { WorkoutCard } from "@/components/ui/workout-card";
import { ReadinessCard } from "@/features/dashboard/readiness-card";
import { ProposedChangesPanel } from "@/features/plan/proposed-changes";
import { WhoopMetrics } from "@/features/whoop/metrics";
import { greeting, shiftIsoDate, sportLabel } from "@/lib/utils";
import type { WhoopMetricView } from "@/services/wearables/whoop";

type TodayWorkout = {
  id: string;
  sport: string;
  title: string;
  duration_min: number | null;
  objective: string | null;
  why_text: string | null;
  status?: string | null;
  intensity?: string | null;
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
  event: { id: string; event_type: string; name: string; days: number; priority?: string | null; phase?: string | null } | null;
  events?: Array<{ id: string; event_type: string; name: string; days: number; priority?: string | null; phase?: string | null }>;
  insight: { id: string; title: string; body: string; factors: unknown; proposed_changes?: unknown } | null;
  conflict: { title: string; explanation: string } | null;
  whoop: { status: string; metrics: WhoopMetricView[] } | null;
  recovery?: {
    eventId: string;
    eventName: string;
    recoveryDays: number;
    endDate: string;
    medicalGuidance?: string;
    recommendations?: Array<{ title: string; detail: string }>;
  } | null;
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
  insight,
  conflict,
  whoop,
  event,
  events = [],
  recovery = null,
}: HomeDashboardProps) {
  const router = useRouter();
  const [pendingInsight, startInsight] = useTransition();
  const [insightDone, setInsightDone] = useState(false);
  const [showInsightDetail, setShowInsightDetail] = useState(false);
  const overall = scores.find((score) => score.dimension === "overall");
  const factors = Array.isArray(insight?.factors) ? insight.factors as Array<{ label: string; detail: string }> : [];
  const activeEvents = events.length ? events : event ? [event] : [];
  const completedWeek = weekWorkouts.filter((w) => w.status === "completed").length;
  const plannedWeek = weekWorkouts.length;
  const weekMinutes = weekWorkouts.reduce((sum, w) => sum + (w.duration_min ?? 0), 0);
  const todayEvent = activeEvents.find((item) => item.days === 0) ?? null;
  const eventSessions = todayWorkouts.filter((w) => w.intensity === "race" || /event|race|marathon|triathlon|ironman/i.test(w.title));
  const primaryToday = todayEvent || eventSessions.length
    ? (eventSessions[0] ?? null)
    : (todayWorkouts.find((w) => w.status !== "completed") ?? todayWorkouts[0] ?? null);
  const nextWorkout = primaryToday;
  const dateLabel = new Date(`${today}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const priorityLabel = (priority?: string | null) =>
    priority === "primary" ? "A" : priority === "secondary" ? "B" : priority === "practice" ? "C" : "—";

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
    <main className="mx-auto grid w-full min-w-0 max-w-5xl gap-4 px-4 py-4 *:min-w-0 sm:py-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="caption">{dateLabel}</p>
          <h1 className="page-title mt-0.5">{greeting(name, hour)}</h1>
          {isDemo ? <div className="mt-2"><DemoBanner /></div> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Link href="/notifications" className="btn btn-ghost btn-sm" aria-label="Notifications">
            <Bell size={16} strokeWidth={1.75} aria-hidden />
          </Link>
          <Link href="/profile" className="btn btn-ghost btn-sm">Profile</Link>
        </div>
      </header>

      <ReadinessCard readiness={readiness} />
      {readiness?.blocked_for_safety ? <SafetyBanner /> : null}

      {recovery ? (
        <section className="app-card grid gap-3 border-l-2 border-l-maroon p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="eyebrow">Post-event recovery</p>
              <h2 className="mt-1 text-lg font-bold">{recovery.eventName}</h2>
              <p className="caption mt-1">~{recovery.recoveryDays} easy days · through {recovery.endDate}</p>
            </div>
            <Link className="btn btn-ghost btn-sm" href={`/events/${recovery.eventId}`}>Open</Link>
          </div>
          {recovery.medicalGuidance ? (
            <p className="text-sm text-danger">{recovery.medicalGuidance}</p>
          ) : (
            <ul className="grid gap-1 text-sm text-muted">
              {(recovery.recommendations ?? []).slice(0, 2).map((item) => (
                <li key={item.title}><span className="font-semibold text-ink">{item.title}.</span> {item.detail}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Link className="btn btn-primary btn-sm" href="/recovery?tab=checkin">Readiness check-in</Link>
            <Link className="btn btn-ghost btn-sm" href="/plan">Adjusted sessions</Link>
          </div>
        </section>
      ) : null}

      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="section-title">{todayEvent ? "Today's event" : "Today's training"}</h2>
          <Link className="text-sm font-bold text-maroon" href="/plan">Plan</Link>
        </div>
        {todayEvent ? (
          <article className="app-card grid gap-3 border-l-2 border-l-maroon p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-maroon-soft text-maroon">
                <Flag size={18} strokeWidth={1.75} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold">{todayEvent.name}</p>
                <p className="caption">
                  {todayEvent.event_type} · Priority {priorityLabel(todayEvent.priority)}
                  {todayEvent.phase ? ` · ${todayEvent.phase}` : ""}
                </p>
                <p className="mt-2 text-sm text-muted">
                  The event replaces ordinary training today. It counts toward load — not as a missed workout.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link className="btn btn-primary" href={`/events/${todayEvent.id}`}>Event preparation</Link>
              <Link className="btn btn-ghost" href="/nutrition">Race nutrition</Link>
            </div>
          </article>
        ) : todayWorkouts.length === 0 ? (
          <EmptyState
            title="Rest day"
            body="Nothing is scheduled. Open the plan to review the week or start a free session."
            href="/train"
            action="Open Train"
            icon={CalendarDays}
          />
        ) : (
          <ul className="grid gap-3">
            {todayWorkouts.map((workout) => (
              <li key={workout.id}>
                <WorkoutCard
                  id={workout.id}
                  sport={workout.sport}
                  title={workout.title}
                  durationMin={workout.duration_min}
                  intensity={workout.intensity}
                  status={workout.status}
                  objective={workout.objective}
                  actionLabel={workout.status === "completed" ? "View" : workout.camera ? "Start · camera ready" : "Start"}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {insight && !insightDone ? (
        <section className="grid gap-2">
          <InsightCard
            title={insight.title}
            body={insight.body}
            href="/ai"
            action="Ask coach"
          />
          <button
            type="button"
            className="btn btn-ghost btn-sm w-full sm:w-auto"
            onClick={() => setShowInsightDetail((open) => !open)}
          >
            {showInsightDetail ? "Hide plan changes" : "Review plan changes"}
          </button>
          {showInsightDetail ? (
            <div className="app-card p-4">
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
          ) : null}
        </section>
      ) : null}

      {conflict ? (
        <article className="app-card border-l-2 border-l-danger p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-danger">{conflict.title}</p>
          <p className="mt-1 text-sm text-muted">{conflict.explanation}</p>
          <Link className="btn btn-primary mt-3 w-full sm:w-auto" href="/conflicts">Resolve</Link>
        </article>
      ) : null}

      <section className="app-card grid gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="section-title">This week</h2>
          <Link className="text-sm font-bold text-maroon" href="/progress">Progress</Link>
        </div>
        <ProgressIndicator
          value={completedWeek}
          max={Math.max(plannedWeek, 1)}
          label={`${completedWeek}/${plannedWeek} sessions · ${weekMinutes} min planned`}
        />
        {overall?.score != null ? (
          <p className="text-sm text-muted">
            Performance score <span className="metric font-bold text-ink">{overall.score}</span>
            {overall.explanation ? ` · ${overall.explanation}` : ""}
          </p>
        ) : null}
        <WeekDots today={today} workouts={weekWorkouts} />
      </section>

      {activeEvents[0] && !todayEvent ? (
        <Link href={`/events/${activeEvents[0].id}`} className="app-card flex items-center gap-3 p-4 transition-colors hover:bg-elevated">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-maroon-soft text-maroon">
            <Flag size={18} strokeWidth={1.75} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">{activeEvents[0].name}</span>
            <span className="caption">
              {activeEvents[0].days} days · Priority {priorityLabel(activeEvents[0].priority)}
              {activeEvents[0].phase ? ` · ${activeEvents[0].phase}` : ""}
            </span>
          </span>
        </Link>
      ) : null}

      {whoop ? (
        <article className="app-card p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="section-title">WHOOP</h2>
            <Link className="text-sm font-bold text-maroon" href="/more">Manage</Link>
          </div>
          <div className="mt-3">
            <WhoopMetrics metrics={whoop.metrics} compact />
          </div>
        </article>
      ) : null}

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {nextWorkout ? (
          <QuickAction href={`/train/${nextWorkout.id}`} icon={Sparkles} label="Start workout" />
        ) : (
          <QuickAction href="/train" icon={Sparkles} label="Train" />
        )}
        <QuickAction href="/recovery?tab=checkin" icon={ClipboardCheck} label="Check-in" />
        <QuickAction href="/train#log" icon={Plus} label="Log activity" />
        <QuickAction href="/health" icon={CalendarDays} label="Health" />
      </section>
    </main>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Sparkles;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="app-card flex min-h-14 items-center gap-2 px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon"
    >
      <Icon size={16} strokeWidth={1.75} className="shrink-0 text-maroon" aria-hidden />
      {label}
    </Link>
  );
}

function WeekDots({
  today,
  workouts,
}: {
  today: string;
  workouts: WeekWorkout[];
}) {
  const days = Array.from({ length: 7 }, (_, index) => shiftIsoDate(today, index));
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {days.map((date) => {
        const rows = workouts.filter((workout) => workout.scheduled_date === date);
        const done = rows.some((row) => row.status === "completed");
        const planned = rows.length > 0;
        const label = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "narrow", timeZone: "UTC" });
        return (
          <Link
            key={date}
            href={rows[0] ? `/train/${rows[0].id}` : "/plan"}
            className="grid place-items-center gap-1 rounded-[var(--radius-sm)] py-1.5 text-center hover:bg-elevated"
            title={rows.length ? rows.map((r) => r.title).join(", ") : "Rest"}
          >
            <span className="text-[10px] font-bold uppercase text-muted">{label}</span>
            <span
              className={
                date === today
                  ? "h-2.5 w-2.5 rounded-full bg-maroon"
                  : done
                    ? "h-2.5 w-2.5 rounded-full bg-success"
                    : planned
                      ? "h-2.5 w-2.5 rounded-full bg-line ring-1 ring-muted/40"
                      : "h-2.5 w-2.5 rounded-full bg-transparent ring-1 ring-line"
              }
              aria-hidden
            />
            <span className="sr-only">
              {date === today ? "Today" : label}: {rows.length ? rows.map((r) => `${sportLabel(r.sport)} ${r.title}`).join(", ") : "Rest"}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
