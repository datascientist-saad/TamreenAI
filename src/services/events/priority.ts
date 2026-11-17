/**
 * Event priority recommendation (A/B/C → primary/secondary/practice).
 * Deterministic rules with documented assumptions. Never auto-forces A for every long race.
 */

import type { EventPriority } from "./catalog";

export type PriorityRecommendationInput = {
  distanceM: number | null;
  swimM?: number | null;
  bikeM?: number | null;
  runM?: number | null;
  discipline: string;
  templateSlug?: string | null;
  experienceLevel?: string | null;
  /** Other active events, soonest first. */
  otherEvents?: Array<{
    startsOn: string;
    priority: EventPriority;
    distanceM?: number | null;
    name?: string;
  }>;
  eventDate: string;
  today: string;
};

export type PriorityRecommendation = {
  recommended: EventPriority;
  label: "A" | "B" | "C";
  rationale: string;
  factors: Array<{ label: string; detail: string }>;
};

const PRIORITY_LABEL: Record<EventPriority, "A" | "B" | "C"> = {
  primary: "A",
  secondary: "B",
  practice: "C",
};

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

function totalDemandM(input: PriorityRecommendationInput): number {
  const parts = [input.swimM, input.bikeM, input.runM].filter((v): v is number => v != null && Number.isFinite(v));
  if (parts.length) return parts.reduce((sum, v) => sum + v, 0);
  return input.distanceM ?? 0;
}

function isMajorChampionshipSlug(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return ["ironman", "ironman_70_3", "running_marathon", "t100", "running_ultra"].includes(slug);
}

/**
 * Recommend A/B/C priority. Athlete may override.
 * Assumptions: longer + more specific races tend toward A only when they are season-defining;
 * short local races default to C/B; existing A events nearby push new races toward B/C.
 */
export function recommendEventPriority(input: PriorityRecommendationInput): PriorityRecommendation {
  const factors: Array<{ label: string; detail: string }> = [];
  const demand = totalDemandM(input);
  const daysOut = daysBetween(input.today, input.eventDate);
  factors.push({ label: "Demand", detail: `Estimated event load distance ${Math.round(demand)} m.` });
  factors.push({ label: "Horizon", detail: `${daysOut} days until the event.` });

  let score = 0;

  if (isMajorChampionshipSlug(input.templateSlug)) {
    score += 4;
    factors.push({ label: "Template", detail: `${input.templateSlug} is typically a season focus.` });
  } else if (input.discipline === "triathlon" && demand >= 100_000) {
    score += 4;
    factors.push({ label: "Triathlon load", detail: "Middle/full distance triathlon usually warrants primary prep." });
  } else if (demand >= 42_000) {
    score += 3;
    factors.push({ label: "Distance", detail: "Marathon-distance or longer often needs dedicated prep." });
  } else if (demand >= 21_000) {
    score += 2;
    factors.push({ label: "Distance", detail: "Half-marathon scale is often a B race unless it is the season goal." });
  } else if (demand >= 10_000) {
    score += 1;
    factors.push({ label: "Distance", detail: "10K-scale events are useful benchmarks." });
  } else if (demand > 0 && demand < 8_000) {
    score -= 1;
    factors.push({ label: "Distance", detail: "Short events often fit as training races." });
  }

  if (input.discipline === "strength") {
    score += 1;
    factors.push({ label: "Discipline", detail: "Strength competitions need specific peaking when they are the goal." });
  }

  const others = input.otherEvents ?? [];
  const existingPrimary = others.filter((e) => e.priority === "primary");
  if (existingPrimary.length) {
    score -= 2;
    factors.push({
      label: "Existing A event",
      detail: `${existingPrimary.map((e) => e.name ?? e.startsOn).join(", ")} already marked primary — avoid stacking A races.`,
    });
    for (const primary of existingPrimary) {
      const gap = Math.abs(daysBetween(input.eventDate, primary.startsOn));
      if (gap < 42) {
        score -= 1;
        factors.push({ label: "Proximity to A", detail: `${gap} days from an existing primary event.` });
      }
    }
  }

  if (daysOut < 10 && demand < 15_000) {
    score -= 1;
    factors.push({ label: "Short notice", detail: "Near-term short race usually integrates as a training stimulus." });
  }

  if (input.experienceLevel === "beginner" && demand >= 21_000 && !existingPrimary.length) {
    score += 1;
    factors.push({ label: "Experience", detail: "Beginners often treat their first long race as the primary goal." });
  }

  let recommended: EventPriority;
  if (score >= 3) recommended = "primary";
  else if (score >= 1) recommended = "secondary";
  else recommended = "practice";

  // Never assume every long race is automatically A when another A already exists nearby.
  if (recommended === "primary" && existingPrimary.some((e) => Math.abs(daysBetween(input.eventDate, e.startsOn)) < 28)) {
    recommended = "secondary";
    factors.push({
      label: "Override safety",
      detail: "Downgraded from A to B because another primary event is within four weeks.",
    });
  }

  const rationale =
    recommended === "primary"
      ? "Recommended as an A event: full preparation, taper, and recovery should prioritize this date."
      : recommended === "secondary"
        ? "Recommended as a B event: useful race, moderate taper only when it does not harm an A goal."
        : "Recommended as a C / training race: integrate into normal training with minimal taper.";

  return {
    recommended,
    label: PRIORITY_LABEL[recommended],
    rationale,
    factors,
  };
}

export function priorityDisplayLabel(priority: EventPriority): "A" | "B" | "C" {
  return PRIORITY_LABEL[priority];
}
