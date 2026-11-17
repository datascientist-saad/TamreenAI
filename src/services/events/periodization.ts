/**
 * Adaptive event training phases with dated boundaries.
 * Not rigid date blocks — durations scale with priority, time available, and difficulty.
 */

import { resolveEventTemplate, type EventPriority } from "./catalog";
import { buildPhasePlan, type EventTemplate } from "./templates";
import { individualizeTaper, type IndividualizedTaper } from "./taper";

export type EventPhaseType = "base" | "build" | "peak" | "taper" | "event" | "recovery" | "return";

export type DatedEventPhase = {
  phase: EventPhaseType;
  startDate: string;
  endDate: string;
  objectives: string;
  sortOrder: number;
  adjustments: Record<string, unknown>;
};

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

function recoveryDaysFor(priority: EventPriority, demandM: number, taper: IndividualizedTaper): number {
  if (priority === "practice") return Math.max(1, Math.min(3, Math.ceil(demandM / 20_000)));
  if (priority === "secondary") return Math.max(2, Math.min(7, Math.ceil(demandM / 12_000)));
  return Math.max(3, Math.min(14, Math.max(taper.taperDays, Math.ceil(demandM / 8_000))));
}

export type PeriodizationInput = {
  eventDate: string;
  endsOn?: string | null;
  today: string;
  templateSlug: string | null;
  discipline: string;
  distanceM: number | null;
  swimM?: number | null;
  bikeM?: number | null;
  runM?: number | null;
  priority: EventPriority;
  experienceLevel?: string | null;
  readinessOverall?: number | null;
};

/**
 * Build dated phases for one event. When the event is very close, skip base/build
 * rather than compressing months of preparation into a few days.
 */
export function buildDatedEventPhases(input: PeriodizationInput): {
  phases: DatedEventPhase[];
  taper: IndividualizedTaper;
  template: EventTemplate | null;
} {
  const eventEnd = input.endsOn && input.endsOn >= input.eventDate ? input.endsOn : input.eventDate;
  const demand =
    [input.swimM, input.bikeM, input.runM].filter((v): v is number => v != null).reduce((s, v) => s + v, 0)
    || input.distanceM
    || 0;
  const daysOut = Math.max(0, daysBetween(input.today, input.eventDate));
  const taper = individualizeTaper({
    templateSlug: input.templateSlug,
    discipline: input.discipline,
    distanceM: input.distanceM,
    priority: input.priority,
    experienceLevel: input.experienceLevel,
    readinessOverall: input.readinessOverall,
    daysUntilEvent: daysOut,
  });

  const template = input.templateSlug ? resolveEventTemplate(input.templateSlug) : null;
  const weeksAvailable = Math.max(1, Math.ceil(daysOut / 7));
  const hintPhases = template
    ? buildPhasePlan(template, weeksAvailable)
    : [
      { phase: "base" as const, weeksHint: 2, focus: "Aerobic development and movement quality" },
      { phase: "build" as const, weeksHint: 2, focus: "Sport-specific preparation" },
      { phase: "peak" as const, weeksHint: 1, focus: "Race-specific sharpness" },
      { phase: "taper" as const, weeksHint: 1, focus: "Reduce fatigue, preserve fitness" },
      { phase: "recovery" as const, weeksHint: 1, focus: "Post-event unload" },
    ];

  const phases: DatedEventPhase[] = [];
  let sortOrder = 0;

  // Event day(s)
  const eventPhase: DatedEventPhase = {
    phase: "event",
    startDate: input.eventDate,
    endDate: eventEnd,
    objectives: "Competition replaces regular training. Optional warm-up and cooldown only.",
    sortOrder: 0, // reassigned later
    adjustments: { replacesWorkouts: true },
  };

  const recoveryLen = recoveryDaysFor(input.priority, demand, taper);
  const recoveryStart = addDays(eventEnd, 1);
  const recoveryEnd = addDays(eventEnd, recoveryLen);
  const returnStart = addDays(recoveryEnd, 1);
  const returnEnd = addDays(returnStart, Math.max(3, Math.min(10, Math.ceil(recoveryLen * 0.75))));

  // Very short horizon: do not invent base/build.
  if (daysOut <= 3) {
    const preStart = input.today < input.eventDate ? input.today : addDays(input.eventDate, -1);
    if (preStart < input.eventDate) {
      phases.push({
        phase: "taper",
        startDate: preStart,
        endDate: addDays(input.eventDate, -1),
        objectives: "Event is imminent — reduce fatigue only. Do not compress a full preparation block.",
        sortOrder: sortOrder++,
        adjustments: { shortHorizon: true, volumeScale: 0.6 },
      });
    }
    eventPhase.sortOrder = sortOrder++;
    phases.push(eventPhase);
    phases.push({
      phase: "recovery",
      startDate: recoveryStart,
      endDate: recoveryEnd,
      objectives: "Conservative return based on event demands and athlete feedback.",
      sortOrder: sortOrder++,
      adjustments: { recoveryDays: recoveryLen },
    });
    phases.push({
      phase: "return",
      startDate: returnStart,
      endDate: returnEnd,
      objectives: "Progressively rebuild volume. Avoid sudden jumps to pre-event workload.",
      sortOrder: sortOrder++,
      adjustments: {},
    });
    return { phases, taper, template };
  }

  const taperStart = addDays(input.eventDate, -Math.max(1, taper.taperDays));
  const prepEnd = addDays(taperStart, -1);

  // Allocate prep weeks from today → prepEnd using template hints (excluding taper/recovery hints).
  const prepHints = hintPhases.filter((p) => p.phase !== "taper" && p.phase !== "recovery");
  const prepDays = Math.max(0, daysBetween(input.today, prepEnd) + 1);

  if (prepDays <= 0) {
    // Entire remaining window is taper.
    phases.push({
      phase: "taper",
      startDate: input.today,
      endDate: addDays(input.eventDate, -1),
      objectives: taper.reasons.join(" "),
      sortOrder: sortOrder++,
      adjustments: { volumeReductionPct: taper.volumeReductionPct, keepIntensity: taper.keepIntensity },
    });
  } else {
    const totalHint = prepHints.reduce((s, p) => s + Math.max(1, p.weeksHint), 0) || 1;
    let cursor = input.today;
    for (let i = 0; i < prepHints.length; i += 1) {
      const hint = prepHints[i];
      const share = Math.max(1, hint.weeksHint) / totalHint;
      const span = i === prepHints.length - 1
        ? Math.max(0, daysBetween(cursor, prepEnd))
        : Math.max(0, Math.round(prepDays * share) - 1);
      const end = i === prepHints.length - 1 ? prepEnd : addDays(cursor, span);
      if (end < cursor) continue;
      // Map build → sport-specific prep language for secondary label clarity
      const phase: EventPhaseType = hint.phase === "base" ? "base" : hint.phase === "peak" ? "peak" : "build";
      phases.push({
        phase,
        startDate: cursor,
        endDate: end,
        objectives: hint.focus,
        sortOrder: sortOrder++,
        adjustments: { weeksHint: hint.weeksHint, priority: input.priority },
      });
      cursor = addDays(end, 1);
      if (cursor > prepEnd) break;
    }

    if (taperStart < input.eventDate) {
      const taperFrom = taperStart < input.today ? input.today : taperStart;
      if (taperFrom < input.eventDate) {
        phases.push({
          phase: "taper",
          startDate: taperFrom,
          endDate: addDays(input.eventDate, -1),
          objectives: taper.reasons.join(" "),
          sortOrder: sortOrder++,
          adjustments: {
            volumeReductionPct: taper.volumeReductionPct,
            keepIntensity: taper.keepIntensity,
            deloadBefore: taper.suggestDeload,
          },
        });
      }
    }
  }

  eventPhase.sortOrder = sortOrder++;
  phases.push(eventPhase);
  phases.push({
    phase: "recovery",
    startDate: recoveryStart,
    endDate: recoveryEnd,
    objectives: "Reduce training stress according to actual event demands and athlete feedback.",
    sortOrder: sortOrder++,
    adjustments: { recoveryDays: recoveryLen },
  });
  phases.push({
    phase: "return",
    startDate: returnStart,
    endDate: returnEnd,
    objectives: "Progressively rebuild training volume and intensity.",
    sortOrder: sortOrder++,
    adjustments: {},
  });

  return { phases, taper, template };
}

export function currentPhaseForDate(phases: DatedEventPhase[], date: string): DatedEventPhase | null {
  return phases.find((phase) => phase.startDate <= date && phase.endDate >= date) ?? null;
}
