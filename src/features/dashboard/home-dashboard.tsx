"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Bell,
  CalendarDays,
  ClipboardCheck,
  Flag,
  Heart,
  Plus,
  Sparkles,
  Utensils,
} from "lucide-react";
import { pageContainerClass } from "@/components/page";
import { DemoBanner, SafetyBanner } from "@/components/states";
import { ResumeWorkoutBanner } from "@/components/resume-workout";
import { EmptyState } from "@/components/ui/empty-state";
import { InsightCard } from "@/components/ui/insight-card";
import { ProgressIndicator } from "@/components/ui/progress-indicator";
import { WorkoutCard } from "@/components/ui/workout-card";
import { ReadinessCard } from "@/features/dashboard/readiness-card";
import { RacePrepCard } from "@/features/events/race-prep-card";
import { ProposedChangesPanel } from "@/features/plan/proposed-changes";
import { WhoopMetrics } from "@/features/whoop/metrics";
import { withReturnTo } from "@/lib/navigation";
import { greeting, shiftIsoDate, sportLabel } from "@/lib/utils";
import type { RacePrepSnapshot } from "@/services/events/race-prep";
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
  events?: Array<{ id: string; event_type: string; name: string; days: number; priority?: string | null; phase?: string | null; racePrep?: RacePrepSnapshot | null }>;
  racePrepEvent?: { id: string; racePrep: RacePrepSnapshot | null } | null;
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
  hasPlan?: boolean;
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
  racePrepEvent = null,
  recovery = null,
  hasPlan = true,
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
  const orderedToday = [...todayWorkouts].sort((a, b) => {
    const aDone = a.status === "completed" ? 1 : 0;
    const bDone = b.status === "completed" ? 1 : 0;
    return aDone - bDone;
  });
  const primaryToday = todayEvent || eventSessions.length
    ? (eventSessions[0] ?? null)
    : (orderedToday.find((w) => w.status !== "completed") ?? orderedToday[0] ?? null);
  const nextWorkout = primaryToday;
  const nextPlanned = weekWorkouts.find((w) => w.scheduled_date > today && w.status !== "completed") ?? null;
  const dateLabel = new Date(`${today}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const todayReturn = "/home";
  const eventHref = (id: string) => withReturnTo(`/events/${id}`, todayReturn);

  const fromList = activeEvents.find((item): item is typeof item & { racePrep: RacePrepSnapshot } =>
    "racePrep" in item && Boolean(item.racePrep),
  );
  const prep: RacePrepSnapshot | null = racePrepEvent?.racePrep ?? fromList?.racePrep ?? null;
  const prepEventId = racePrepEvent?.id ?? fromList?.id ?? null;
  const isRaceDay = Boolean(todayEvent) || prep?.phase === "race_day";
  const showUpcomingRaceRow = Boolean(prep && prepEventId && !isRaceDay && prep.phase !== "recover" && prep.phase !== "result");
  const isRecoveryDay = prep?.phase === "fuel" && prep.daysUntil === 1 && !todayEvent;

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

  const coachHref = insight
    ? `/ai?kind=change&id=${encodeURIComponent(insight.id)}&context=${encodeURIComponent(insight.title)}&body=${encodeURIComponent(insight.body.slice(0, 280))}&from=${encodeURIComponent("/home")}`
    : "/ai";

  const prepHref = prepEventId
    ? `/events/${prepEventId}/prep?from=${encodeURIComponent("/home")}`
    : null;

  return (
    <main className={pageContainerClass({ compact: true })}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="caption">{dateLabel}</p>
          <h1 className="page-title mt-0.5">{greeting(name, hour)}</h1>
          {isDemo ? <div className="mt-2"><DemoBanner /></div> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 md:hidden">
          <Link href="/notifications" className="btn btn-ghost btn-sm min-h-11 min-w-11" aria-label="Notifications">
            <Bell size={16} strokeWidth={1.75} aria-hidden />
          </Link>
          <Link href="/profile" className="btn btn-ghost btn-sm">Profile</Link>
        </div>
        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <Link href="/notifications" className="btn btn-ghost btn-sm" aria-label="Notifications">
            <Bell size={16} strokeWidth={1.75} aria-hidden />
            Alerts
          </Link>
          <Link href="/profile" className="btn btn-ghost btn-sm">Profile</Link>
        </div>
      </header>

      {readiness?.blocked_for_safety ? <SafetyBanner /> : null}

      <div className="md:hidden">
        <ReadinessCard readiness={readiness} compact />
      </div>

      <ResumeWorkoutBanner />

      {recovery ? (
        <section className="app-card grid gap-3 border-l-2 border-l-maroon p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-ink">Post-event recovery</p>
              <h2 className="mt-1 text-lg font-bold">{recovery.eventName}</h2>
              <p className="caption mt-1">~{recovery.recoveryDays} easy days · through {recovery.endDate}</p>
            </div>
            <Link className="btn btn-ghost btn-sm" href={eventHref(recovery.eventId)}>Open</Link>
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

      <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] md:items-start lg:gap-6">
      <div className="grid gap-4">
      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="section-title">
            {todayEvent ? "Today's race" : isRecoveryDay ? "Today's recovery" : "Today's training"}
          </h2>
          <Link className="text-sm font-semibold text-maroon" href="/plan">Plan</Link>
        </div>

        {todayEvent && prep ? (
          <article className="app-card grid gap-3 p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-maroon-soft text-maroon">
                <Flag size={18} strokeWidth={1.75} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold">{todayEvent.name}</p>
                <p className="mt-1 text-sm text-muted">
                  {prep.startLabel ?? `${prep.eventDateLabel} · Add start time`}
                </p>
                <p className="mt-1 text-sm font-semibold text-ink" aria-label={prep.countdownAnnounce}>
                  {prep.countdownLabel}
                </p>
                <p className="mt-1 text-sm text-muted">{prep.kitProgress.label}</p>
              </div>
            </div>
            <Link className="btn btn-primary w-full sm:w-auto" href={prepHref ?? eventHref(todayEvent.id)}>
              Open Race Prep
            </Link>
          </article>
        ) : todayEvent ? (
          <article className="app-card grid gap-3 p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-maroon-soft text-maroon">
                <Flag size={18} strokeWidth={1.75} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold">{todayEvent.name}</p>
                <p className="mt-1 text-sm text-muted">
                  The event replaces ordinary training today.
                </p>
              </div>
            </div>
            <Link className="btn btn-primary w-full sm:w-auto" href={`/events/${todayEvent.id}/prep?from=${encodeURIComponent("/home")}`}>
              Open Race Prep
            </Link>
          </article>
        ) : isRecoveryDay ? (
          <article className="app-card grid gap-3 p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-maroon-soft text-maroon">
                <Heart size={18} strokeWidth={1.75} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold">Recovery day</p>
                <p className="mt-1 text-sm text-muted">
                  Rest and optional gentle mobility only. Race is tomorrow.
                </p>
              </div>
            </div>
            {prepHref ? (
              <Link className="btn btn-primary w-full sm:w-auto" href={prepHref}>
                Continue Race Prep
              </Link>
            ) : null}
          </article>
        ) : !hasPlan ? (
          <EmptyState
            title="Create your first plan"
            body="Tamreen builds a hybrid week from your sports, days, and goal event."
            href="/onboarding"
            action="Create your first plan"
            icon={CalendarDays}
          />
        ) : todayWorkouts.length === 0 ? (
          <EmptyState
            title="Rest day"
            body={nextPlanned
              ? `Next session: ${nextPlanned.title} on ${nextPlanned.scheduled_date} (${sportLabel(nextPlanned.sport)}).`
              : "Nothing is scheduled. Open the plan to review the week or start a free session."}
            href={nextPlanned ? withReturnTo(`/train/${nextPlanned.id}`, todayReturn) : "/train"}
            action={nextPlanned ? "Open next session" : "Log an activity"}
            icon={CalendarDays}
          />
        ) : (
          <div className="grid gap-3">
            {nextWorkout ? (
              <WorkoutCard
                id={nextWorkout.id}
                sport={nextWorkout.sport}
                title={nextWorkout.title}
                durationMin={nextWorkout.duration_min}
                intensity={nextWorkout.intensity}
                status={nextWorkout.status}
                objective={nextWorkout.objective}
                href={withReturnTo(`/train/${nextWorkout.id}`, todayReturn)}
                actionLabel={
                  nextWorkout.status === "completed"
                    ? "View"
                    : nextWorkout.camera
                      ? "Start workout · camera ready"
                      : "Start workout"
                }
              />
            ) : null}
            {orderedToday.length > 1 ? (
              <ul className="app-card divide-y divide-line px-2 py-1">
                {orderedToday.map((workout, index) => (
                  <li key={workout.id}>
                    <Link
                      href={withReturnTo(`/train/${workout.id}`, todayReturn)}
                      className="flex min-h-12 items-center gap-3 px-2 py-2.5"
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-elevated text-xs font-bold text-muted">{index + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{workout.title}</span>
                        <span className="caption">{sportLabel(workout.sport)}{workout.status === "completed" ? " · Done" : ""}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </section>

      {showUpcomingRaceRow && prep && prepEventId ? (
        <RacePrepCard
          model={{
            eventId: prepEventId,
            eventName: prep.eventName,
            countdownLabel: prep.countdownLabel,
            countdownAnnounce: prep.countdownAnnounce,
            startLabel: prep.startLabel,
            startTimeLabel: prep.startTimeLabel,
            timeZoneDisplay: prep.timeZoneDisplay,
            eventDateLabel: prep.eventDateLabel,
            needsStartTime: prep.needsStartTime,
            kitProgress: prep.kitProgress,
            phase: prep.phase,
            imageUrl: prep.imageUrl,
            from: "/home",
          }}
        />
      ) : null}

      {insight && !insightDone ? (
        <section className="grid gap-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="section-title">Pending plan changes</p>
            <Link className="btn btn-ghost btn-sm" href={coachHref}>Ask about this change</Link>
          </div>
          <InsightCard
            title={insight.title}
            body={insight.body}
            href={coachHref}
            action="Ask about this change"
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
          <p className="text-sm font-semibold text-danger">{conflict.title}</p>
          <p className="mt-1 text-sm text-muted">{conflict.explanation}</p>
          <Link className="btn btn-primary mt-3 w-full sm:w-auto" href="/conflicts">Resolve</Link>
        </article>
      ) : null}
      </div>

      <aside className="grid gap-4 md:sticky md:top-4">
      <div className="hidden md:block">
        <ReadinessCard readiness={readiness} compact />
      </div>

      <section className="app-card grid gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="section-title">This week</h2>
          <Link className="text-sm font-semibold text-maroon" href="/progress">Progress</Link>
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

      {whoop ? (
        <article className="app-card p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="section-title">WHOOP</h2>
            <Link className="text-sm font-semibold text-maroon" href="/more">Manage</Link>
          </div>
          <div className="mt-3">
            <WhoopMetrics metrics={whoop.metrics} compact />
          </div>
        </article>
      ) : null}

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-2">
        {nextWorkout && !todayEvent ? (
          <QuickAction href={withReturnTo(`/train/${nextWorkout.id}`, todayReturn)} icon={Sparkles} label="Start workout" />
        ) : (
          <QuickAction href="/train" icon={Sparkles} label="Train" />
        )}
        <QuickAction href="/recovery?tab=checkin" icon={ClipboardCheck} label="Check-in" />
        <QuickAction href="/train#log" icon={Plus} label="Log activity" />
        {todayEvent || nextWorkout ? (
          <QuickAction href="/nutrition" icon={Utensils} label="Fueling" />
        ) : (
          <QuickAction href="/plan?tab=events" icon={Flag} label="Events" />
        )}
      </section>
      </aside>
      </div>
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
            href={rows[0] ? withReturnTo(`/train/${rows[0].id}`, "/home") : `/plan?day=${date}`}
            className="grid min-h-11 place-items-center gap-1 rounded-[var(--radius-sm)] py-1.5 text-center hover:bg-elevated"
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
