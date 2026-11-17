/**
 * Plan recalculation pipeline for event create / edit / cancel / complete.
 * Deterministic proposal generation; persistence and approval happen in server actions.
 */

import type { EventPriority } from "./catalog";
import { evaluateEventCompatibility, type CompatibilityReport } from "./compatibility";
import {
  proposeEventDayReplacements,
  proposeTaperAdaptations,
  type AdaptationProposal,
  type ScheduledWorkoutRef,
} from "./adaptation";
import { buildDatedEventPhases, currentPhaseForDate, type DatedEventPhase } from "./periodization";
import { buildEventNutritionPlan, fuelingPracticePayload } from "./nutrition";
import { buildPostEventRecovery, type PostEventCheckIn, type RecoveryPlan } from "./recovery";
import { analyzeEventResult, type EventResultInput, type PerformanceAnalysis } from "./results-analysis";
import { recommendEventPriority, type PriorityRecommendation } from "./priority";
import type { PlanningEvent } from "./multi-event";
import { toPlanningEvents } from "./multi-event";

export type RecalculationTrigger =
  | "event_create"
  | "event_edit"
  | "event_cancel"
  | "event_complete"
  | "priority_change";

export type RecalculationContext = {
  today: string;
  trigger: RecalculationTrigger;
  athlete: {
    experienceLevel?: string | null;
    readinessOverall?: number | null;
    injuryAreas?: string[];
    dietaryPattern?: string | null;
    allergies?: string[] | null;
  };
  /** All active events including the subject event (unless cancelled). */
  events: PlanningEvent[];
  subjectEventId: string;
  templateSlug?: string | null;
  endsOn?: string | null;
  upcomingWorkouts: ScheduledWorkoutRef[];
  checkIn?: PostEventCheckIn | null;
  resultInput?: EventResultInput | null;
};

export type RecalculationResult = {
  subject: PlanningEvent;
  priorityRecommendation: PriorityRecommendation | null;
  compatibility: CompatibilityReport;
  phases: DatedEventPhase[];
  currentPhase: DatedEventPhase | null;
  adaptations: AdaptationProposal[];
  nutrition: ReturnType<typeof buildEventNutritionPlan> | null;
  fuelingPractice: Record<string, unknown> | null;
  recovery: RecoveryPlan | null;
  performance: PerformanceAnalysis | null;
  summary: {
    title: string;
    body: string;
    factors: Array<{ label: string; detail: string }>;
  };
};

function subjectOf(ctx: RecalculationContext): PlanningEvent {
  const found = ctx.events.find((e) => e.id === ctx.subjectEventId);
  if (found) return found;
  throw new Error("Subject event missing from recalculation context.");
}

/**
 * Run the deterministic recalculation pipeline (steps 2–5 of the product spec).
 * Does not write to the database.
 */
export function recalculateForEvent(ctx: RecalculationContext): RecalculationResult {
  const subject = subjectOf(ctx);
  const others = ctx.events.filter((e) => e.id !== subject.id);

  const priorityRecommendation = ctx.trigger === "event_create" || ctx.trigger === "priority_change"
    ? recommendEventPriority({
      distanceM: subject.distanceM,
      swimM: subject.swimM,
      bikeM: subject.bikeM,
      runM: subject.runM,
      discipline: subject.discipline,
      templateSlug: ctx.templateSlug,
      experienceLevel: ctx.athlete.experienceLevel,
      otherEvents: others.map((e) => ({
        startsOn: e.startsOn,
        priority: e.priority,
        distanceM: e.distanceM,
        name: e.name,
      })),
      eventDate: subject.startsOn,
      today: ctx.today,
    })
    : null;

  const compatibility = evaluateEventCompatibility(ctx.events);

  const { phases } = buildDatedEventPhases({
    eventDate: subject.startsOn,
    endsOn: ctx.endsOn,
    today: ctx.today,
    templateSlug: ctx.templateSlug ?? null,
    discipline: subject.discipline,
    distanceM: subject.distanceM,
    swimM: subject.swimM,
    bikeM: subject.bikeM,
    runM: subject.runM,
    priority: subject.priority,
    experienceLevel: ctx.athlete.experienceLevel,
    readinessOverall: ctx.athlete.readinessOverall,
  });
  const currentPhase = currentPhaseForDate(phases, ctx.today);

  let adaptations: AdaptationProposal[] = [];
  let recovery: RecoveryPlan | null = null;
  let performance: PerformanceAnalysis | null = null;

  if (ctx.trigger === "event_cancel") {
    adaptations = ctx.upcomingWorkouts
      .filter((w) => w.isEventSession || (w as { eventId?: string }).eventId === subject.id)
      .filter((w) => w.status !== "completed")
      .map((w) => ({
        adaptationType: "restore" as const,
        originalWorkoutId: w.id,
        original: {
          date: w.date,
          title: w.title,
          sport: w.sport,
          durationMin: w.durationMin,
          intensity: w.intensity,
        },
        proposed: null,
        explanation: `${subject.name} was cancelled. Remove its event-day constraint and return to normal training with current fitness in mind — do not blindly restore old hard sessions.`,
        expectedImpact: "Future event constraints cleared. Completed history unchanged.",
        idempotencyKey: `cancel-clear:${subject.id}:${w.id}`,
      }));
  } else if (ctx.trigger === "event_complete") {
    const end = ctx.endsOn && ctx.endsOn >= subject.startsOn ? ctx.endsOn : subject.startsOn;
    recovery = buildPostEventRecovery(subject, end, ctx.checkIn);
    if (ctx.resultInput) {
      performance = analyzeEventResult(subject, ctx.resultInput);
    }
    adaptations = [];
  } else {
    const withEnds = ctx.events.map((e) => ({
      ...e,
      endsOn: e.id === subject.id ? ctx.endsOn : undefined,
    }));
    adaptations = [
      ...proposeEventDayReplacements(ctx.upcomingWorkouts, withEnds),
      ...proposeTaperAdaptations(ctx.upcomingWorkouts, subject, {
        templateSlug: ctx.templateSlug,
        experienceLevel: ctx.athlete.experienceLevel,
        readinessOverall: ctx.athlete.readinessOverall,
      }),
    ];
  }

  // Validate: never touch completed
  adaptations = adaptations.filter((a) => {
    if (!a.originalWorkoutId) return true;
    const original = ctx.upcomingWorkouts.find((w) => w.id === a.originalWorkoutId);
    return !original || original.status !== "completed";
  });

  // Deduplicate by idempotency key
  const seen = new Set<string>();
  adaptations = adaptations.filter((a) => {
    if (seen.has(a.idempotencyKey)) return false;
    seen.add(a.idempotencyKey);
    return true;
  });

  const daysUntil = Math.round(
    (Date.parse(`${subject.startsOn}T00:00:00Z`) - Date.parse(`${ctx.today}T00:00:00Z`)) / 86_400_000,
  );
  const nutrition = ctx.trigger === "event_cancel"
    ? null
    : buildEventNutritionPlan({
      event: subject,
      phase: currentPhase?.phase ?? "prep",
      daysUntil,
      dietaryPattern: ctx.athlete.dietaryPattern,
      allergies: ctx.athlete.allergies,
      experienceLevel: ctx.athlete.experienceLevel,
    });

  const factors = [
    { label: "Trigger", detail: ctx.trigger },
    { label: "Compatibility", detail: compatibility.status },
    { label: "Current phase", detail: currentPhase?.phase ?? "n/a" },
    { label: "Proposed adaptations", detail: String(adaptations.length) },
    ...compatibility.findings.slice(0, 3).map((f) => ({ label: f.title, detail: f.detail })),
  ];

  const summary = {
    title:
      ctx.trigger === "event_complete"
        ? `Recovery plan for ${subject.name}`
        : ctx.trigger === "event_cancel"
          ? `Clear constraints for ${subject.name}`
          : `Adapt training for ${subject.name}`,
    body:
      ctx.trigger === "event_complete"
        ? (recovery?.medicalGuidance || `Post-event recovery for ~${recovery?.recoveryDays ?? 0} days. Review before resuming hard training.`)
        : ctx.trigger === "event_cancel"
          ? "Event cancelled. Future event-day constraints can be cleared; completed workouts stay unchanged."
          : `Event day blocks regular workouts. ${adaptations.length} proposed change${adaptations.length === 1 ? "" : "s"} for review. Compatibility: ${compatibility.status}.`,
    factors,
  };

  return {
    subject,
    priorityRecommendation,
    compatibility,
    phases,
    currentPhase,
    adaptations,
    nutrition,
    fuelingPractice: nutrition ? fuelingPracticePayload(nutrition) : null,
    recovery,
    performance,
    summary,
  };
}

/** Map adaptation proposals into ai_recommendations.proposed_changes shape. */
export function adaptationsToProposedChanges(adaptations: AdaptationProposal[]) {
  return adaptations.map((row) => ({
    id: row.idempotencyKey,
    title: row.proposed?.title ?? row.original?.title ?? "Training change",
    fromDate: row.original?.date ?? "—",
    toDate: row.proposed?.date ?? (row.adaptationType === "event_day_replace" && !row.proposed ? "Removed" : "—"),
    fromDurationMin: row.original?.durationMin ?? null,
    toDurationMin: row.proposed?.durationMin ?? null,
    fromIntensity: row.original?.intensity ?? null,
    toIntensity: row.proposed?.intensity ?? null,
    reason: row.explanation,
    impact: row.expectedImpact,
    adaptationType: row.adaptationType,
    originalWorkoutId: row.originalWorkoutId,
    proposed: row.proposed,
    detail: row.explanation,
  }));
}

export function planningEventsFromRows(
  rows: Array<{
    id: string;
    name: string;
    starts_on: string;
    distance_m?: number | null;
    swim_m?: number | null;
    bike_m?: number | null;
    run_m?: number | null;
    goal_time_seconds?: number | null;
    priority?: string | null;
    status?: string | null;
    discipline?: string | null;
    event_type?: string | null;
    course?: Record<string, unknown> | null;
  }>,
  today: string,
): PlanningEvent[] {
  return toPlanningEvents(rows, today);
}

export type { EventPriority };
