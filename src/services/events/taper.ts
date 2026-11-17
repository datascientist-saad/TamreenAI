/**
 * Sport-specific taper and deload guidelines.
 * Starting ranges are configurable defaults — individualized by readiness and priority.
 * Taper ≠ deload: taper preserves race fitness; deload reduces accumulated stress anytime.
 */

import type { EventPriority } from "./catalog";

export type TaperProfile = {
  slug: string;
  label: string;
  /** Inclusive guideline range in days before event start. */
  minDays: number;
  maxDays: number;
  volumeReductionPct: { start: number; end: number };
  keepIntensity: boolean;
  notes: string;
};

/** Configurable starting guidelines — not mandatory durations. */
export const TAPER_GUIDELINES: TaperProfile[] = [
  { slug: "running_5k", label: "5K", minDays: 0, maxDays: 4, volumeReductionPct: { start: 20, end: 40 }, keepIntensity: true, notes: "Short freshen-up; quality openers OK." },
  { slug: "running_10k", label: "10K", minDays: 3, maxDays: 7, volumeReductionPct: { start: 30, end: 50 }, keepIntensity: true, notes: "Trim volume; keep a short race-pace touch." },
  { slug: "running_half", label: "Half marathon", minDays: 7, maxDays: 14, volumeReductionPct: { start: 35, end: 55 }, keepIntensity: true, notes: "Protect legs; avoid heavy lower-body strength late." },
  { slug: "running_marathon", label: "Marathon", minDays: 10, maxDays: 21, volumeReductionPct: { start: 40, end: 60 }, keepIntensity: true, notes: "Progressive volume cut; preserve marathon-pace snippets." },
  { slug: "running_ultra", label: "Ultramarathon", minDays: 14, maxDays: 21, volumeReductionPct: { start: 45, end: 65 }, keepIntensity: false, notes: "Emphasize freshness over sharpness." },
  { slug: "sprint_triathlon", label: "Sprint triathlon", minDays: 3, maxDays: 7, volumeReductionPct: { start: 30, end: 50 }, keepIntensity: true, notes: "Short openers across three sports." },
  { slug: "olympic_triathlon", label: "Olympic triathlon", minDays: 5, maxDays: 10, volumeReductionPct: { start: 35, end: 55 }, keepIntensity: true, notes: "Reduce brick load; keep technique." },
  { slug: "ironman_70_3", label: "Ironman 70.3", minDays: 7, maxDays: 14, volumeReductionPct: { start: 40, end: 60 }, keepIntensity: true, notes: "Cut long bricks; keep short race-pace touches." },
  { slug: "ironman", label: "Full Ironman", minDays: 14, maxDays: 21, volumeReductionPct: { start: 45, end: 65 }, keepIntensity: false, notes: "Large volume cut; conservative intensity." },
  { slug: "t100", label: "T100", minDays: 7, maxDays: 14, volumeReductionPct: { start: 40, end: 60 }, keepIntensity: true, notes: "Similar to middle-distance triathlon taper." },
  { slug: "cycling_event", label: "Cycling event", minDays: 3, maxDays: 10, volumeReductionPct: { start: 30, end: 50 }, keepIntensity: true, notes: "Reduce long rides; keep neuromuscular openers." },
  { slug: "swimming_event", label: "Swimming event", minDays: 3, maxDays: 7, volumeReductionPct: { start: 25, end: 45 }, keepIntensity: true, notes: "Technique and short race-pace." },
  { slug: "strength_competition", label: "Strength competition", minDays: 3, maxDays: 7, volumeReductionPct: { start: 40, end: 60 }, keepIntensity: true, notes: "Lower volume, openers near competition loads." },
];

export type TaperContext = {
  templateSlug: string | null;
  discipline: string;
  distanceM: number | null;
  priority: EventPriority;
  experienceLevel?: string | null;
  /** 0–100 readiness if available; null when unknown. */
  readinessOverall?: number | null;
  recentWeeklyVolumeMin?: number | null;
  sleepHoursRecent?: number | null;
  injuryAreas?: string[];
  daysUntilEvent: number;
};

export type IndividualizedTaper = {
  taperDays: number;
  volumeReductionPct: number;
  keepIntensity: boolean;
  profile: TaperProfile;
  reasons: string[];
  /** True when taper should be minimal (C race or insufficient time). */
  minimal: boolean;
  /** Deload suggestion independent of race taper. */
  suggestDeload: boolean;
  deloadDays: number;
};

function resolveProfile(templateSlug: string | null, discipline: string, distanceM: number | null): TaperProfile {
  if (templateSlug) {
    const hit = TAPER_GUIDELINES.find((row) => row.slug === templateSlug);
    if (hit) return hit;
  }
  if (discipline === "triathlon") {
    const demand = distanceM ?? 0;
    if (demand >= 200_000) return TAPER_GUIDELINES.find((r) => r.slug === "ironman")!;
    if (demand >= 100_000) return TAPER_GUIDELINES.find((r) => r.slug === "ironman_70_3")!;
    if (demand >= 40_000) return TAPER_GUIDELINES.find((r) => r.slug === "olympic_triathlon")!;
    return TAPER_GUIDELINES.find((r) => r.slug === "sprint_triathlon")!;
  }
  if (discipline === "running") {
    const d = distanceM ?? 0;
    if (d >= 50_000) return TAPER_GUIDELINES.find((r) => r.slug === "running_ultra")!;
    if (d >= 40_000) return TAPER_GUIDELINES.find((r) => r.slug === "running_marathon")!;
    if (d >= 20_000) return TAPER_GUIDELINES.find((r) => r.slug === "running_half")!;
    if (d >= 8_000) return TAPER_GUIDELINES.find((r) => r.slug === "running_10k")!;
    return TAPER_GUIDELINES.find((r) => r.slug === "running_5k")!;
  }
  if (discipline === "cycling") return TAPER_GUIDELINES.find((r) => r.slug === "cycling_event")!;
  if (discipline === "swimming") return TAPER_GUIDELINES.find((r) => r.slug === "swimming_event")!;
  if (discipline === "strength") return TAPER_GUIDELINES.find((r) => r.slug === "strength_competition")!;
  return {
    slug: "generic",
    label: "Generic event",
    minDays: 3,
    maxDays: 7,
    volumeReductionPct: { start: 30, end: 50 },
    keepIntensity: true,
    notes: "Conservative generic taper.",
  };
}

/**
 * Individualize taper length and volume cut.
 * Does not claim full recovery from readiness alone.
 */
export function individualizeTaper(ctx: TaperContext): IndividualizedTaper {
  const profile = resolveProfile(ctx.templateSlug, ctx.discipline, ctx.distanceM);
  const reasons: string[] = [`Guideline for ${profile.label}: ${profile.minDays}–${profile.maxDays} days.`];

  let taperDays = Math.round((profile.minDays + profile.maxDays) / 2);
  let volumeCut = Math.round((profile.volumeReductionPct.start + profile.volumeReductionPct.end) / 2);

  if (ctx.priority === "practice") {
    const days = Math.min(2, Math.max(0, profile.minDays));
    reasons.push("C / practice race — minimize taper disruption.");
    return {
      taperDays: days,
      volumeReductionPct: 15,
      keepIntensity: true,
      profile,
      reasons,
      minimal: true,
      suggestDeload: false,
      deloadDays: 0,
    };
  }

  if (ctx.priority === "secondary") {
    taperDays = Math.max(profile.minDays, Math.round(taperDays * 0.7));
    volumeCut = Math.round(volumeCut * 0.75);
    reasons.push("B event — moderate taper that protects primary goals.");
  } else {
    reasons.push("A event — full event-specific taper.");
  }

  if (ctx.experienceLevel === "beginner") {
    taperDays = Math.min(profile.maxDays, taperDays + 2);
    reasons.push("Beginner: slightly longer freshen-up.");
  } else if (ctx.experienceLevel === "advanced" || ctx.experienceLevel === "elite") {
    taperDays = Math.max(profile.minDays, taperDays - 1);
    reasons.push("Experienced athlete: slightly shorter taper within guideline.");
  }

  if (ctx.readinessOverall != null && ctx.readinessOverall < 45) {
    taperDays = Math.min(profile.maxDays, taperDays + 2);
    volumeCut = Math.min(70, volumeCut + 10);
    reasons.push("Low readiness score — extend freshen-up conservatively (not a medical clearance).");
  } else if (ctx.readinessOverall != null && ctx.readinessOverall >= 80) {
    reasons.push("Readiness looks solid — keep planned intensity touches; readiness alone does not prove full recovery.");
  } else if (ctx.readinessOverall == null) {
    reasons.push("No readiness score available — using guideline defaults.");
  }

  if (ctx.sleepHoursRecent != null && ctx.sleepHoursRecent < 6) {
    volumeCut = Math.min(70, volumeCut + 5);
    reasons.push("Recent short sleep — favor volume reduction.");
  }

  if ((ctx.injuryAreas?.length ?? 0) > 0) {
    taperDays = Math.min(profile.maxDays, taperDays + 1);
    reasons.push("Injury areas on profile — keep loading conservative.");
  }

  if (ctx.daysUntilEvent < taperDays) {
    taperDays = Math.max(0, ctx.daysUntilEvent);
    reasons.push("Event is closer than a full taper — do not compress months of prep into a few days; reduce fatigue only.");
  }

  const highVolume = (ctx.recentWeeklyVolumeMin ?? 0) > 600;
  const suggestDeload = highVolume && ctx.daysUntilEvent > taperDays + 7;
  const deloadDays = suggestDeload ? 4 : 0;
  if (suggestDeload) {
    reasons.push("High recent weekly volume — a short deload before the taper window can reduce accumulated stress.");
  }

  return {
    taperDays,
    volumeReductionPct: volumeCut,
    keepIntensity: profile.keepIntensity,
    profile,
    reasons,
    minimal: taperDays <= 2,
    suggestDeload,
    deloadDays,
  };
}

/** True when a session date falls inside the taper window before the event. */
export function isInTaperWindow(sessionDate: string, eventStartsOn: string, taperDays: number): boolean {
  if (taperDays <= 0) return false;
  const start = Date.parse(`${eventStartsOn}T00:00:00Z`) - taperDays * 86_400_000;
  const day = Date.parse(`${sessionDate}T00:00:00Z`);
  const event = Date.parse(`${eventStartsOn}T00:00:00Z`);
  return day >= start && day < event;
}

export function volumeScaleForTaperDay(
  sessionDate: string,
  eventStartsOn: string,
  taper: IndividualizedTaper,
): number {
  if (!isInTaperWindow(sessionDate, eventStartsOn, taper.taperDays)) return 1;
  const daysOut = Math.round((Date.parse(`${eventStartsOn}T00:00:00Z`) - Date.parse(`${sessionDate}T00:00:00Z`)) / 86_400_000);
  const progress = 1 - Math.max(0, Math.min(1, (daysOut - 1) / Math.max(taper.taperDays, 1)));
  const cut = taper.volumeReductionPct / 100;
  return Math.max(0.35, 1 - cut * (0.5 + 0.5 * progress));
}
