/**
 * Event-day replacement and intelligent workout rescheduling proposals.
 * Deterministic constraints; never silently mutates completed history.
 */

import type { EventPriority } from "./catalog";
import { formatDistanceKm } from "./catalog";
import { individualizeTaper, isInTaperWindow, volumeScaleForTaperDay } from "./taper";

/** Loose event shape accepted by adaptation helpers (matches engine PlanningEventRef). */
export type AdaptationEvent = {
  id: string;
  name: string;
  startsOn: string;
  priority: EventPriority;
  discipline: string;
  distanceM?: number | null;
  swimM?: number | null;
  bikeM?: number | null;
  runM?: number | null;
  goalTimeSeconds?: number | null;
  sports?: Array<"running" | "cycling" | "swimming" | "strength">;
  endsOn?: string | null;
};

export type AdaptationType =
  | "event_day_replace"
  | "move"
  | "reduce_volume"
  | "reduce_intensity"
  | "replace"
  | "remove"
  | "add_recovery"
  | "combine"
  | "restore";

export type ScheduledWorkoutRef = {
  id: string;
  date: string;
  sport: string;
  title: string;
  durationMin: number;
  intensity: string;
  importance: string;
  status: string;
  expectedLoad?: number;
  lowerBody?: boolean;
  quality?: boolean;
  isEventSession?: boolean;
};

export type AdaptationProposal = {
  adaptationType: AdaptationType;
  originalWorkoutId: string | null;
  original: {
    date: string;
    title: string;
    sport: string;
    durationMin: number;
    intensity: string;
  } | null;
  proposed: {
    date: string;
    title: string;
    sport: string;
    durationMin: number;
    intensity: string;
    objective?: string;
    why?: string;
    isEventSession?: boolean;
    eventId?: string;
  } | null;
  explanation: string;
  expectedImpact: string;
  idempotencyKey: string;
};

export type EventDaySession = {
  date: string;
  sport: string;
  title: string;
  objective: string;
  durationMin: number;
  intensity: "race";
  expectedLoad: number;
  importance: "key";
  why: string;
  isEventSession: true;
  eventId: string;
  structure: Record<string, unknown>;
};

function isHard(workout: ScheduledWorkoutRef): boolean {
  return workout.quality
    || ["tempo", "threshold", "vo2", "race", "max"].includes(workout.intensity)
    || workout.title.toLowerCase().includes("long")
    || (workout.lowerBody === true && workout.intensity !== "recovery" && workout.sport.includes("strength"));
}

function primarySportForEvent(event: AdaptationEvent): string {
  if (event.discipline === "triathlon") return "brick";
  const sports = event.sports ?? [];
  if (sports.includes("running")) return "running";
  if (sports.includes("cycling")) return "cycling";
  if (sports.includes("swimming")) return "swimming";
  if (sports.includes("strength")) return "strength";
  if (event.discipline === "running") return "running";
  if (event.discipline === "cycling") return "cycling";
  if (event.discipline === "swimming") return "swimming";
  if (event.discipline === "strength") return "strength";
  return "running";
}

function estimateEventDurationMin(event: AdaptationEvent): number {
  if (event.goalTimeSeconds && event.goalTimeSeconds > 0) {
    return Math.min(600, Math.max(20, Math.round(event.goalTimeSeconds / 60)));
  }
  const demand =
    [event.swimM, event.bikeM, event.runM].filter((v): v is number => v != null).reduce((s, v) => s + v, 0)
    || event.distanceM
    || 10000;
  // Rough: ~5.5 min/km run equivalent for mixed demand — conservative floor/ceiling.
  return Math.min(600, Math.max(30, Math.round((demand / 1000) * 5.5)));
}

export function buildEventDaySession(event: AdaptationEvent, date: string): EventDaySession {
  const sport = primarySportForEvent(event);
  const distanceLabel = event.swimM || event.bikeM || event.runM
    ? `${formatDistanceKm(event.swimM ?? null)} / ${formatDistanceKm(event.bikeM ?? null)} / ${formatDistanceKm(event.runM ?? null)}`
    : formatDistanceKm(event.distanceM ?? null);
  const durationMin = estimateEventDurationMin(event);
  return {
    date,
    sport,
    title: event.name,
    objective: `Event day · ${event.priority} priority`,
    durationMin,
    intensity: "race",
    expectedLoad: Math.round(durationMin * 0.85),
    importance: "key",
    why: `${event.name} replaces regular training on this day. Distance ${distanceLabel}. Warm-up and cooldown as needed; do not stack a full training session.`,
    isEventSession: true,
    eventId: event.id,
    structure: {
      isEventSession: true,
      eventId: event.id,
      eventPriority: event.priority,
      distanceM: event.distanceM,
      swimM: event.swimM,
      bikeM: event.bikeM,
      runM: event.runM,
      supportsEventIds: [event.id],
      supportsEventNames: [event.name],
    },
  };
}

export function eventDateSpan(event: AdaptationEvent): string[] {
  const end = event.endsOn && event.endsOn >= event.startsOn ? event.endsOn : event.startsOn;
  const dates: string[] = [];
  let cursor = event.startsOn;
  while (cursor <= end && dates.length < 21) {
    dates.push(cursor);
    const next = new Date(`${cursor}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    cursor = next.toISOString().slice(0, 10);
  }
  return dates;
}

/**
 * Strip non-event planned workouts on event days and emit replace proposals.
 * Completed workouts are never modified.
 */
export function proposeEventDayReplacements(
  workouts: ScheduledWorkoutRef[],
  events: AdaptationEvent[],
): AdaptationProposal[] {
  const proposals: AdaptationProposal[] = [];
  for (const event of events) {
    for (const date of eventDateSpan(event)) {
      const onDay = workouts.filter((w) => w.date === date && w.status !== "completed");
      for (const workout of onDay) {
        if (workout.isEventSession && workout.id) continue;
        proposals.push({
          adaptationType: "event_day_replace",
          originalWorkoutId: workout.id,
          original: {
            date: workout.date,
            title: workout.title,
            sport: workout.sport,
            durationMin: workout.durationMin,
            intensity: workout.intensity,
          },
          proposed: null,
          explanation: `${event.name} is the primary activity on ${date}. Regular session "${workout.title}" is removed from event day (not counted as missed).`,
          expectedImpact: "Event day shows the competition only. Optional warm-up/mobility can be added separately.",
          idempotencyKey: `event-day-replace:${event.id}:${workout.id}`,
        });
      }
      // Ensure an event session is proposed when none exists
      const hasEvent = onDay.some((w) => w.isEventSession);
      if (!hasEvent) {
        const session = buildEventDaySession(event, date);
        proposals.push({
          adaptationType: "event_day_replace",
          originalWorkoutId: null,
          original: null,
          proposed: {
            date: session.date,
            title: session.title,
            sport: session.sport,
            durationMin: session.durationMin,
            intensity: session.intensity,
            objective: session.objective,
            why: session.why,
            isEventSession: true,
            eventId: event.id,
          },
          explanation: `Schedule ${event.name} as the event-day session on ${date}.`,
          expectedImpact: "Event counts toward training load and sport volume; it is not a missed workout.",
          idempotencyKey: `event-day-insert:${event.id}:${date}`,
        });
      }
    }
  }
  return proposals;
}

/**
 * Propose taper adjustments for workouts before an event.
 * Does not stack hard days; never increases volume to compensate.
 */
export function proposeTaperAdaptations(
  workouts: ScheduledWorkoutRef[],
  event: AdaptationEvent,
  options?: { templateSlug?: string | null; experienceLevel?: string | null; readinessOverall?: number | null },
): AdaptationProposal[] {
  const daysUntil = Math.max(
    0,
    Math.round((Date.parse(`${event.startsOn}T00:00:00Z`) - Date.parse(`${workouts[0]?.date ?? event.startsOn}T00:00:00Z`)) / 86_400_000),
  );
  // Compute from event and a synthetic "today" = earliest future workout or event-14
  const future = workouts.filter((w) => w.date < event.startsOn && w.status !== "completed");
  if (!future.length) return [];

  const todayProxy = future.map((w) => w.date).sort()[0];
  const taper = individualizeTaper({
    templateSlug: options?.templateSlug ?? null,
    discipline: event.discipline,
    distanceM: event.distanceM ?? null,
    priority: event.priority,
    experienceLevel: options?.experienceLevel,
    readinessOverall: options?.readinessOverall,
    daysUntilEvent: Math.max(0, Math.round((Date.parse(`${event.startsOn}T00:00:00Z`) - Date.parse(`${todayProxy}T00:00:00Z`)) / 86_400_000)),
  });

  if (taper.minimal && event.priority === "practice") {
    // Practice races: only replace a suitable session on event day (handled elsewhere).
    return [];
  }

  const proposals: AdaptationProposal[] = [];
  const eventDates = new Set(eventDateSpan(event));

  for (const workout of future) {
    if (eventDates.has(workout.date)) continue;
    if (!isInTaperWindow(workout.date, event.startsOn, taper.taperDays)) continue;

    const scale = volumeScaleForTaperDay(workout.date, event.startsOn, taper);
    const daysOut = Math.round((Date.parse(`${event.startsOn}T00:00:00Z`) - Date.parse(`${workout.date}T00:00:00Z`)) / 86_400_000);

    // Day before A/B: rest or optional shakeout
    if (daysOut === 1 && event.priority !== "practice" && isHard(workout)) {
      proposals.push({
        adaptationType: "replace",
        originalWorkoutId: workout.id,
        original: {
          date: workout.date,
          title: workout.title,
          sport: workout.sport,
          durationMin: workout.durationMin,
          intensity: workout.intensity,
        },
        proposed: {
          date: workout.date,
          title: "Optional shakeout",
          sport: workout.sport === "strength" || workout.sport === "bodybuilding" ? "mobility" : workout.sport,
          durationMin: Math.min(30, Math.max(15, Math.round(workout.durationMin * 0.35))),
          intensity: "recovery",
          why: `Pre-event shakeout before ${event.name}.`,
        },
        explanation: `Replace hard session "${workout.title}" with an optional shakeout the day before ${event.name}.`,
        expectedImpact: "Lowers pre-race fatigue without stacking compensatory hard work elsewhere.",
        idempotencyKey: `taper-shakeout:${event.id}:${workout.id}`,
      });
      continue;
    }

    // Heavy lower / quality in taper → reduce
    if (isHard(workout)) {
      const nextDuration = Math.max(20, Math.round(workout.durationMin * scale));
      const nextIntensity = taper.keepIntensity && daysOut > 3 && ["tempo", "threshold"].includes(workout.intensity)
        ? workout.intensity
        : workout.intensity === "vo2" || workout.intensity === "race" || workout.intensity === "max"
          ? "easy"
          : workout.intensity === "threshold"
            ? "tempo"
            : workout.intensity === "tempo"
              ? "moderate"
              : "easy";

      if (nextDuration < workout.durationMin || nextIntensity !== workout.intensity) {
        proposals.push({
          adaptationType: nextIntensity !== workout.intensity ? "reduce_intensity" : "reduce_volume",
          originalWorkoutId: workout.id,
          original: {
            date: workout.date,
            title: workout.title,
            sport: workout.sport,
            durationMin: workout.durationMin,
            intensity: workout.intensity,
          },
          proposed: {
            date: workout.date,
            title: nextIntensity === "easy" || nextIntensity === "recovery"
              ? workout.title.replace(/interval|tempo|threshold|vo2|heavy|long/ig, "easy").trim() || `Easy ${workout.sport}`
              : workout.title,
            sport: workout.sport,
            durationMin: nextDuration,
            intensity: nextIntensity,
            why: `${event.name} taper (${taper.taperDays}d, ~${taper.volumeReductionPct}% volume cut).`,
          },
          explanation: `Taper adjustment for ${event.name}: ${workout.title} → shorter/easier session.`,
          expectedImpact: `Reduces accumulated fatigue while ${taper.keepIntensity ? "preserving some intensity" : "favoring freshness"}.`,
          idempotencyKey: `taper-adjust:${event.id}:${workout.id}:${nextDuration}:${nextIntensity}`,
        });
      }
    }
  }

  void daysUntil;
  return proposals;
}

/**
 * Apply event-day sessions into a planned session list (for buildPlan).
 * Removes non-event sessions on event dates; inserts event sessions.
 */
export function applyEventDaysToSessions<T extends {
  date: string;
  sport: string;
  title: string;
  objective: string;
  durationMin: number;
  intensity: string;
  expectedLoad: number;
  importance: string;
  recoveryHours: number;
  why: string;
  lowerBody: boolean;
  quality: boolean;
  phase: string;
  structure: Record<string, unknown>;
  zones: Record<string, string>;
  exercises: unknown[];
}>(
  sessions: T[],
  events: AdaptationEvent[],
): T[] {
  if (!events.length) return sessions;
  const eventDates = new Map<string, AdaptationEvent>();
  for (const event of events) {
    for (const date of eventDateSpan(event)) {
      // Prefer higher priority if two events somehow share a day
      const existing = eventDates.get(date);
      const rank = { primary: 0, secondary: 1, practice: 2 } as const;
      if (!existing || rank[event.priority] < rank[existing.priority]) {
        eventDates.set(date, event);
      }
    }
  }
  const filtered = sessions.filter((session) => !eventDates.has(session.date));
  const inserted: T[] = [];
  for (const [date, event] of eventDates) {
    const day = buildEventDaySession(event, date);
    inserted.push({
      date: day.date,
      sport: day.sport as T["sport"],
      title: day.title,
      objective: day.objective,
      durationMin: day.durationMin,
      intensity: day.intensity as T["intensity"],
      expectedLoad: day.expectedLoad,
      importance: day.importance as T["importance"],
      recoveryHours: 48,
      why: day.why,
      lowerBody: day.sport === "running" || day.sport === "brick" || day.sport === "strength",
      quality: true,
      phase: "taper",
      structure: day.structure,
      zones: {},
      exercises: [],
    } as unknown as T);
  }
  return [...filtered, ...inserted].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

export function scaleSessionsForTaper<T extends {
  date: string;
  durationMin: number;
  intensity: string;
  title: string;
  sport: string;
  expectedLoad: number;
  quality: boolean;
  why: string;
  structure: Record<string, unknown>;
  phase: string;
}>(
  sessions: T[],
  event: AdaptationEvent,
  priority: EventPriority,
  options?: { templateSlug?: string | null },
): T[] {
  const earliest = sessions[0]?.date ?? event.startsOn;
  const taper = individualizeTaper({
    templateSlug: options?.templateSlug ?? null,
    discipline: event.discipline,
    distanceM: event.distanceM ?? null,
    priority,
    daysUntilEvent: Math.max(0, Math.round((Date.parse(`${event.startsOn}T00:00:00Z`) - Date.parse(`${earliest}T00:00:00Z`)) / 86_400_000)),
  });
  if (taper.minimal) return sessions;

  return sessions.map((session) => {
    if (session.date >= event.startsOn) return session;
    if (!isInTaperWindow(session.date, event.startsOn, taper.taperDays)) return session;
    if ((session.structure as { isEventSession?: boolean }).isEventSession) return session;
    const scale = volumeScaleForTaperDay(session.date, event.startsOn, taper);
    if (scale >= 0.95) return session;
    const durationMin = Math.max(20, Math.round(session.durationMin * scale));
    return {
      ...session,
      durationMin,
      expectedLoad: Math.round(session.expectedLoad * scale),
      phase: "taper",
      structure: { ...session.structure, taperScale: scale, taperEventId: event.id },
      why: `${session.why} Taper for ${event.name}: volume ×${scale.toFixed(2)}.`,
    };
  });
}
