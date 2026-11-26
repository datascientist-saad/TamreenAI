/**
 * Shared event-aware scheduling policy.
 * Used by plan generation, adaptation proposals, calendar display, and reminders.
 * AI may personalize explanations; it must not override these constraints.
 */

import type { EventPriority } from "./catalog";
import { individualizeTaper, isInTaperWindow } from "./taper";

export type PolicySport =
  | "running"
  | "cycling"
  | "swimming"
  | "strength"
  | "bodybuilding"
  | "brick"
  | "mobility"
  | "recovery"
  | "football"
  | "basketball"
  | "volleyball"
  | "cricket"
  | "padel"
  | "tennis"
  | "pickleball"
  | "badminton"
  | "triathlon"
  | string;

export type PolicyEvent = {
  id: string;
  name: string;
  startsOn: string;
  endsOn?: string | null;
  /** Local calendar date derived from starts_at + event timezone when available. */
  localStartsOn?: string | null;
  priority: EventPriority;
  discipline: string;
  distanceM?: number | null;
  swimM?: number | null;
  bikeM?: number | null;
  runM?: number | null;
  sports?: Array<"running" | "cycling" | "swimming" | "strength">;
  templateSlug?: string | null;
  timezone?: string | null;
};

export type DayRole = "normal" | "taper" | "recovery_only" | "event" | "post_recovery";

export type DateProtection = {
  date: string;
  role: DayRole;
  event: PolicyEvent | null;
  /** Sports allowed when role is taper; empty means use athlete preferences. */
  allowedSports: PolicySport[] | null;
  suppressReminders: boolean;
  explanation: string;
};

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

const PRIORITY_RANK: Record<EventPriority, number> = { primary: 0, secondary: 1, practice: 2 };

/** Prefer higher-priority, then earlier start when two events claim the same day. */
export function pickDominantEvent(events: PolicyEvent[]): PolicyEvent | null {
  if (!events.length) return null;
  return [...events].sort((a, b) => {
    const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (byPriority !== 0) return byPriority;
    return eventLocalDate(a).localeCompare(eventLocalDate(b));
  })[0] ?? null;
}

export function eventLocalDate(event: PolicyEvent): string {
  return event.localStartsOn || event.startsOn;
}

export function eventDateSpan(event: PolicyEvent): string[] {
  const start = eventLocalDate(event);
  const end = event.endsOn && event.endsOn >= start ? event.endsOn : start;
  const dates: string[] = [];
  let cursor = start;
  while (cursor <= end && dates.length < 21) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

export function dayBeforeEvent(event: PolicyEvent): string {
  return addDays(eventLocalDate(event), -1);
}

/** Every active race (including practice) gets a recovery-only day before. */
export function isRecoveryOnlyDate(date: string, events: PolicyEvent[]): boolean {
  return events.some((event) => dayBeforeEvent(event) === date && !eventDateSpan(event).includes(date));
}

export function isEventDate(date: string, events: PolicyEvent[]): boolean {
  return events.some((event) => eventDateSpan(event).includes(date));
}

export function eventSports(event: PolicyEvent): Array<"running" | "cycling" | "swimming" | "strength"> {
  if (event.sports?.length) return event.sports;
  if (event.discipline === "triathlon") return ["swimming", "cycling", "running"];
  if (event.discipline === "running") return ["running"];
  if (event.discipline === "cycling") return ["cycling"];
  if (event.discipline === "swimming") return ["swimming"];
  if (event.discipline === "strength") return ["strength"];
  return [];
}

/**
 * Sports that remain schedulable during an event-specific taper.
 * Race-specific work + recovery/mobility only; pause unrelated endurance/gym.
 */
export function allowedSportsDuringTaper(event: PolicyEvent): PolicySport[] {
  const sports = eventSports(event);
  const allowed = new Set<PolicySport>(["recovery", "mobility"]);
  for (const sport of sports) {
    allowed.add(sport);
    if (sport === "running" || sport === "cycling") allowed.add("brick");
    if (event.discipline === "triathlon") {
      allowed.add("brick");
      allowed.add("triathlon");
    }
  }
  // Strength competitions keep strength; running A-races pause standalone gym.
  if (sports.includes("strength") || event.discipline === "strength") {
    allowed.add("strength");
    allowed.add("bodybuilding");
  }
  return [...allowed];
}

export function isSportAllowedOnDate(
  sport: string,
  date: string,
  event: PolicyEvent,
  taperDays: number,
): boolean {
  if (eventDateSpan(event).includes(date)) {
    return false; // event day replaces training; warm-up lives inside Race Day
  }
  if (dayBeforeEvent(event) === date) {
    return sport === "recovery" || sport === "mobility";
  }
  if (!isInTaperWindow(date, eventLocalDate(event), taperDays)) {
    return true;
  }
  if (event.priority === "practice" && taperDays <= 2) {
    // Practice: keep day-before + race-day only; do not wipe the week.
    return true;
  }
  const allowed = allowedSportsDuringTaper(event);
  return allowed.includes(sport);
}

export function taperDaysForEvent(
  event: PolicyEvent,
  options?: { today?: string; experienceLevel?: string | null; readinessOverall?: number | null },
): number {
  const today = options?.today ?? eventLocalDate(event);
  const daysUntil = Math.max(0, daysBetween(today, eventLocalDate(event)));
  const taper = individualizeTaper({
    templateSlug: event.templateSlug ?? null,
    discipline: event.discipline,
    distanceM: event.distanceM ?? null,
    priority: event.priority,
    experienceLevel: options?.experienceLevel,
    readinessOverall: options?.readinessOverall,
    daysUntilEvent: daysUntil,
  });
  return taper.taperDays;
}

/**
 * Classify a calendar date against the active event set.
 * When multiple events overlap, the dominant (highest priority) event wins the role;
 * both events remain visible in the UI.
 */
export function classifyDate(
  date: string,
  events: PolicyEvent[],
  options?: { today?: string; experienceLevel?: string | null; readinessOverall?: number | null },
): DateProtection {
  const onEvent = events.filter((event) => eventDateSpan(event).includes(date));
  if (onEvent.length) {
    const event = pickDominantEvent(onEvent)!;
    return {
      date,
      role: "event",
      event,
      allowedSports: null,
      suppressReminders: true,
      explanation: `${event.name} replaces ordinary training on this day (including evening starts). Optional warm-up lives in Race Day.`,
    };
  }

  const recoveryEvents = events.filter((event) => dayBeforeEvent(event) === date);
  if (recoveryEvents.length) {
    const event = pickDominantEvent(recoveryEvents)!;
    return {
      date,
      role: "recovery_only",
      event,
      allowedSports: ["recovery", "mobility"],
      suppressReminders: true,
      explanation: `Day before ${event.name}: recovery only — rest or optional gentle mobility. No runs, strength, cycling, swimming, tests, or makeup sessions.`,
    };
  }

  // Taper window for the nearest dominant priority event that claims this date.
  const taperCandidates = events
    .map((event) => {
      const taperDays = taperDaysForEvent(event, options);
      return { event, taperDays, inWindow: isInTaperWindow(date, eventLocalDate(event), taperDays) };
    })
    .filter((row) => row.inWindow);

  if (taperCandidates.length) {
    const dominant = pickDominantEvent(taperCandidates.map((row) => row.event))!;
    const taperDays = taperCandidates.find((row) => row.event.id === dominant.id)?.taperDays
      ?? taperDaysForEvent(dominant, options);
    const allowed = allowedSportsDuringTaper(dominant);
    return {
      date,
      role: "taper",
      event: dominant,
      allowedSports: allowed,
      suppressReminders: false,
      explanation: `Taper for ${dominant.name} (${taperDays}d): keep race-specific and recovery work; pause unrelated sports.`,
    };
  }

  return {
    date,
    role: "normal",
    event: null,
    allowedSports: null,
    suppressReminders: false,
    explanation: "No event constraint on this date.",
  };
}

export function suppressWorkoutReminders(date: string, events: PolicyEvent[]): boolean {
  return classifyDate(date, events).suppressReminders;
}

/** Detect recovery overlapping preparation and same-day event clashes. */
export function detectScheduleOverlaps(events: PolicyEvent[]): Array<{
  severity: "warning" | "high";
  title: string;
  detail: string;
  dates: string[];
  eventIds: string[];
}> {
  const findings: Array<{
    severity: "warning" | "high";
    title: string;
    detail: string;
    dates: string[];
    eventIds: string[];
  }> = [];
  const sorted = [...events].sort((a, b) => eventLocalDate(a).localeCompare(eventLocalDate(b)));

  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      const a = sorted[i];
      const b = sorted[j];
      const aDates = new Set(eventDateSpan(a));
      const bDates = new Set(eventDateSpan(b));
      const shared = [...aDates].filter((d) => bDates.has(d));
      if (shared.length) {
        findings.push({
          severity: "high",
          title: "Same-day events",
          detail: `${a.name} and ${b.name} share ${shared.join(", ")}. Choose which event takes priority; both stay visible.`,
          dates: shared,
          eventIds: [a.id, b.id],
        });
      }
      const aRecovery = dayBeforeEvent(a);
      const bRecovery = dayBeforeEvent(b);
      if (aDates.has(bRecovery) || bDates.has(aRecovery)) {
        const dates = [aDates.has(bRecovery) ? bRecovery : aRecovery];
        findings.push({
          severity: "high",
          title: "Recovery overlaps competition",
          detail: `Recovery day for one event falls on competition day for the other (${dates.join(", ")}).`,
          dates,
          eventIds: [a.id, b.id],
        });
      }
      if (aRecovery === bRecovery && !shared.length) {
        findings.push({
          severity: "warning",
          title: "Shared recovery day",
          detail: `${a.name} and ${b.name} both require recovery on ${aRecovery}.`,
          dates: [aRecovery],
          eventIds: [a.id, b.id],
        });
      }
    }
  }
  return findings;
}

/**
 * Resolve local calendar date from a timestamptz + IANA timezone.
 * Falls back to startsOn when start time is unknown.
 */
export function localDateFromStart(
  startsAt: string | null | undefined,
  startsOn: string,
  timeZone: string | null | undefined,
): string {
  if (!startsAt) return startsOn;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(startsAt));
  } catch {
    return startsOn;
  }
}

export function formatStartInZone(
  startsAt: string | null | undefined,
  timeZone: string | null | undefined,
): { timeLabel: string | null; zoneLabel: string | null } {
  if (!startsAt) return { timeLabel: null, zoneLabel: timeZone || null };
  const zone = timeZone || "UTC";
  try {
    const timeLabel = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hourCycle: "h23",
      timeZoneName: "short",
    }).format(new Date(startsAt));
    return { timeLabel, zoneLabel: zone };
  } catch {
    return { timeLabel: startsAt, zoneLabel: zone };
  }
}
