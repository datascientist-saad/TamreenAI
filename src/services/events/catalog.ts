import { EVENT_TEMPLATES, findEventTemplate, type EventTemplate } from "./templates";

export type EventCategory = "running" | "triathlon" | "cycling" | "swimming" | "strength" | "other";
export type EventPriority = "primary" | "secondary" | "practice";

export type EventDistances = {
  distanceM: number | null;
  swimM: number | null;
  bikeM: number | null;
  runM: number | null;
  templateSlug: string | null;
};

export const EVENT_CATEGORIES: Array<{ id: EventCategory; label: string }> = [
  { id: "running", label: "Running" },
  { id: "triathlon", label: "Triathlon" },
  { id: "cycling", label: "Cycling" },
  { id: "swimming", label: "Swimming" },
  { id: "strength", label: "Strength competition" },
  { id: "other", label: "Other / custom" },
];

export const RUNNING_PRESETS = [
  { id: "running_5k", label: "5K", distanceM: 5000 },
  { id: "running_10k", label: "10K", distanceM: 10000 },
  { id: "running_half", label: "Half marathon", distanceM: 21097.5 },
  { id: "running_marathon", label: "Marathon", distanceM: 42195 },
  { id: "running_ultra", label: "Ultramarathon", distanceM: 50000 },
  { id: "running_custom", label: "Custom distance", distanceM: null },
] as const;

export const TRIATHLON_PRESETS = [
  { id: "sprint_triathlon", label: "Sprint", swimM: 750, bikeM: 20000, runM: 5000 },
  { id: "olympic_triathlon", label: "Olympic / Standard", swimM: 1500, bikeM: 40000, runM: 10000 },
  { id: "ironman_70_3", label: "Middle distance / 70.3", swimM: 1900, bikeM: 90000, runM: 21100 },
  { id: "ironman", label: "Full distance", swimM: 3800, bikeM: 180000, runM: 42200 },
  { id: "t100", label: "T100", swimM: 2000, bikeM: 80000, runM: 18000 },
  { id: "triathlon_custom", label: "Custom triathlon", swimM: null, bikeM: null, runM: null },
] as const;

const EXTRA_TEMPLATES: EventTemplate[] = [
  {
    slug: "running_10k",
    name: "10K",
    discipline: "running",
    swimM: null,
    bikeM: null,
    runM: 10000,
    distanceM: 10000,
    minPrepWeeks: 8,
    phases: [
      { phase: "base", weeksHint: 3, focus: "Easy volume" },
      { phase: "build", weeksHint: 3, focus: "Tempo and intervals" },
      { phase: "peak", weeksHint: 1, focus: "Race-pace work" },
      { phase: "taper", weeksHint: 1, focus: "Freshen up" },
      { phase: "recovery", weeksHint: 1, focus: "Easy return" },
    ],
    readinessChecks: ["Longest recent run", "Consistency", "Race-pace session"],
  },
  {
    slug: "running_half",
    name: "Half marathon",
    discipline: "running",
    swimM: null,
    bikeM: null,
    runM: 21097.5,
    distanceM: 21097.5,
    minPrepWeeks: 12,
    phases: [
      { phase: "base", weeksHint: 4, focus: "Aerobic base" },
      { phase: "build", weeksHint: 5, focus: "Long runs and tempo" },
      { phase: "peak", weeksHint: 2, focus: "Specific endurance" },
      { phase: "taper", weeksHint: 1, focus: "Taper" },
      { phase: "recovery", weeksHint: 1, focus: "Recovery" },
    ],
    readinessChecks: ["Longest long run", "Weekly consistency", "Fueling practice"],
  },
  {
    slug: "running_marathon",
    name: "Marathon",
    discipline: "running",
    swimM: null,
    bikeM: null,
    runM: 42195,
    distanceM: 42195,
    minPrepWeeks: 16,
    phases: [
      { phase: "base", weeksHint: 5, focus: "Durable aerobic volume" },
      { phase: "build", weeksHint: 7, focus: "Long runs and threshold" },
      { phase: "peak", weeksHint: 2, focus: "Race-specific work" },
      { phase: "taper", weeksHint: 2, focus: "Taper" },
      { phase: "recovery", weeksHint: 2, focus: "Recovery" },
    ],
    readinessChecks: ["Peak long run", "Consistency", "Fueling practice"],
  },
  {
    slug: "running_ultra",
    name: "Ultramarathon",
    discipline: "running",
    swimM: null,
    bikeM: null,
    runM: 50000,
    distanceM: 50000,
    minPrepWeeks: 20,
    phases: [
      { phase: "base", weeksHint: 6, focus: "Time-on-feet base" },
      { phase: "build", weeksHint: 8, focus: "Back-to-back endurance" },
      { phase: "peak", weeksHint: 3, focus: "Specific long days" },
      { phase: "taper", weeksHint: 2, focus: "Taper" },
      { phase: "recovery", weeksHint: 2, focus: "Recovery" },
    ],
    readinessChecks: ["Longest outing", "Consistency", "Fueling practice"],
  },
  {
    slug: "cycling_event",
    name: "Cycling event",
    discipline: "cycling",
    swimM: null,
    bikeM: null,
    runM: null,
    distanceM: null,
    minPrepWeeks: 8,
    phases: [
      { phase: "base", weeksHint: 3, focus: "Aerobic bike volume" },
      { phase: "build", weeksHint: 3, focus: "Sweet spot and threshold" },
      { phase: "peak", weeksHint: 1, focus: "Race-specific efforts" },
      { phase: "taper", weeksHint: 1, focus: "Taper" },
      { phase: "recovery", weeksHint: 1, focus: "Recovery" },
    ],
    readinessChecks: ["Longest ride", "Consistency", "Intensity tolerance"],
  },
  {
    slug: "swimming_event",
    name: "Swimming event",
    discipline: "swimming",
    swimM: null,
    bikeM: null,
    runM: null,
    distanceM: null,
    minPrepWeeks: 8,
    phases: [
      { phase: "base", weeksHint: 3, focus: "Technique and aerobic swim" },
      { phase: "build", weeksHint: 3, focus: "Race-pace sets" },
      { phase: "peak", weeksHint: 1, focus: "Sharpening" },
      { phase: "taper", weeksHint: 1, focus: "Taper" },
      { phase: "recovery", weeksHint: 1, focus: "Recovery" },
    ],
    readinessChecks: ["Continuous swim near race distance", "Consistency"],
  },
  {
    slug: "strength_competition",
    name: "Strength competition",
    discipline: "strength",
    swimM: null,
    bikeM: null,
    runM: null,
    distanceM: null,
    minPrepWeeks: 8,
    phases: [
      { phase: "base", weeksHint: 3, focus: "General strength" },
      { phase: "build", weeksHint: 3, focus: "Specific lifts" },
      { phase: "peak", weeksHint: 1, focus: "Openers" },
      { phase: "taper", weeksHint: 1, focus: "Taper" },
      { phase: "recovery", weeksHint: 1, focus: "Recovery" },
    ],
    readinessChecks: ["Key lifts practiced", "Recovery managed"],
  },
];

export function allEventTemplates(): EventTemplate[] {
  const map = new Map<string, EventTemplate>();
  for (const row of [...EVENT_TEMPLATES, ...EXTRA_TEMPLATES]) map.set(row.slug, row);
  return [...map.values()];
}

export function resolveEventTemplate(slugOrName: string): EventTemplate | null {
  return findEventTemplate(slugOrName) ?? allEventTemplates().find((row) => row.slug === slugOrName || row.name.toLowerCase() === slugOrName.trim().toLowerCase()) ?? null;
}

export function categoryForEventType(eventType: string): EventCategory {
  if (eventType.startsWith("running") || ["5k", "10k", "half", "marathon", "ultra"].some((part) => eventType.includes(part))) return "running";
  if (eventType.includes("tri") || eventType.includes("ironman") || eventType === "t100") return "triathlon";
  if (eventType.includes("cycl") || eventType.includes("bike")) return "cycling";
  if (eventType.includes("swim")) return "swimming";
  if (eventType.includes("strength") || eventType.includes("powerlifting") || eventType.includes("bodybuild")) return "strength";
  return "other";
}

export function distancesFromPreset(input: {
  category: EventCategory;
  preset: string;
  distanceM?: number | null;
  swimM?: number | null;
  bikeM?: number | null;
  runM?: number | null;
}): EventDistances {
  if (input.category === "running") {
    const preset = RUNNING_PRESETS.find((row) => row.id === input.preset);
    const distanceM = input.preset === "running_custom" ? (input.distanceM ?? null) : (preset?.distanceM ?? input.distanceM ?? null);
    return { distanceM, swimM: null, bikeM: null, runM: distanceM, templateSlug: preset && preset.id !== "running_custom" ? preset.id : null };
  }
  if (input.category === "triathlon") {
    const preset = TRIATHLON_PRESETS.find((row) => row.id === input.preset);
    const swimM = input.swimM ?? preset?.swimM ?? null;
    const bikeM = input.bikeM ?? preset?.bikeM ?? null;
    const runM = input.runM ?? preset?.runM ?? null;
    const custom = input.preset === "triathlon_custom"
      || (preset && (swimM !== preset.swimM || bikeM !== preset.bikeM || runM !== preset.runM));
    const distanceM = [swimM, bikeM, runM].every((value) => value == null) ? null : (swimM ?? 0) + (bikeM ?? 0) + (runM ?? 0);
    return {
      distanceM,
      swimM,
      bikeM,
      runM,
      templateSlug: custom ? null : (preset?.id ?? null),
    };
  }
  if (input.category === "cycling") {
    return { distanceM: input.distanceM ?? null, swimM: null, bikeM: input.distanceM ?? null, runM: null, templateSlug: "cycling_event" };
  }
  if (input.category === "swimming") {
    return { distanceM: input.distanceM ?? null, swimM: input.distanceM ?? null, bikeM: null, runM: null, templateSlug: "swimming_event" };
  }
  if (input.category === "strength") {
    return { distanceM: null, swimM: null, bikeM: null, runM: null, templateSlug: "strength_competition" };
  }
  return { distanceM: input.distanceM ?? null, swimM: input.swimM ?? null, bikeM: input.bikeM ?? null, runM: input.runM ?? null, templateSlug: null };
}

export function formatDistanceKm(metres: number | null | undefined): string {
  if (metres == null || !Number.isFinite(metres)) return "—";
  const km = metres / 1000;
  return Number.isInteger(km) ? `${km} km` : `${Math.round(km * 10) / 10} km`;
}

export function eventSportsDemand(distances: EventDistances, discipline: string): Array<"running" | "cycling" | "swimming" | "strength"> {
  const sports: Array<"running" | "cycling" | "swimming" | "strength"> = [];
  if (discipline === "triathlon" || distances.swimM || distances.bikeM || distances.runM) {
    if (distances.swimM) sports.push("swimming");
    if (distances.bikeM) sports.push("cycling");
    if (distances.runM) sports.push("running");
  } else if (discipline === "running") sports.push("running");
  else if (discipline === "cycling") sports.push("cycling");
  else if (discipline === "swimming") sports.push("swimming");
  else if (discipline === "strength") sports.push("strength");
  return sports;
}
