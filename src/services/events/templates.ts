export interface EventTemplate {
  slug: string;
  name: string;
  discipline: string;
  swimM: number | null;
  bikeM: number | null;
  runM: number | null;
  distanceM: number | null;
  minPrepWeeks: number;
  phases: Array<{ phase: "base" | "build" | "peak" | "taper" | "recovery"; weeksHint: number; focus: string }>;
  readinessChecks: string[];
}

export const EVENT_TEMPLATES: EventTemplate[] = [
  {
    slug: "running_5k",
    name: "5K",
    discipline: "running",
    swimM: null,
    bikeM: null,
    runM: 5000,
    distanceM: 5000,
    minPrepWeeks: 6,
    phases: [
      { phase: "base", weeksHint: 2, focus: "Easy volume and strength support" },
      { phase: "build", weeksHint: 2, focus: "Intervals and tempo" },
      { phase: "peak", weeksHint: 1, focus: "Race-pace sharpness" },
      { phase: "taper", weeksHint: 1, focus: "Fresh legs" },
      { phase: "recovery", weeksHint: 1, focus: "Easy return" },
    ],
    readinessChecks: ["Longest recent run", "Consistency of easy runs", "Race-pace session completed"],
  },
  {
    slug: "sprint_triathlon",
    name: "Sprint triathlon",
    discipline: "triathlon",
    swimM: 750,
    bikeM: 20000,
    runM: 5000,
    distanceM: 25750,
    minPrepWeeks: 8,
    phases: [
      { phase: "base", weeksHint: 3, focus: "Technique and aerobic base across three sports" },
      { phase: "build", weeksHint: 3, focus: "Brick introduction and sport-specific quality" },
      { phase: "peak", weeksHint: 1, focus: "Race rehearsal" },
      { phase: "taper", weeksHint: 1, focus: "Openers and rest" },
      { phase: "recovery", weeksHint: 1, focus: "Unload" },
    ],
    readinessChecks: ["Continuous swim near race distance", "Brick session completed", "Transition practice", "Fueling practice"],
  },
  {
    slug: "olympic_triathlon",
    name: "Olympic triathlon",
    discipline: "triathlon",
    swimM: 1500,
    bikeM: 40000,
    runM: 10000,
    distanceM: 51500,
    minPrepWeeks: 12,
    phases: [
      { phase: "base", weeksHint: 4, focus: "Aerobic durability" },
      { phase: "build", weeksHint: 5, focus: "Threshold and bricks" },
      { phase: "peak", weeksHint: 2, focus: "Race-specific sessions" },
      { phase: "taper", weeksHint: 1, focus: "Taper" },
      { phase: "recovery", weeksHint: 1, focus: "Recovery" },
    ],
    readinessChecks: ["Longest swim/bike/run", "Brick experience", "Consistency", "Fueling practice"],
  },
  {
    slug: "t100",
    name: "T100",
    discipline: "triathlon",
    swimM: 2000,
    bikeM: 80000,
    runM: 18000,
    distanceM: 100000,
    minPrepWeeks: 16,
    phases: [
      { phase: "base", weeksHint: 5, focus: "Swim endurance, bike durability, run volume" },
      { phase: "build", weeksHint: 6, focus: "Long bricks and progressive long days" },
      { phase: "peak", weeksHint: 3, focus: "Race-pace and fueling rehearsal" },
      { phase: "taper", weeksHint: 1, focus: "Race week" },
      { phase: "recovery", weeksHint: 2, focus: "Post-event recovery" },
    ],
    readinessChecks: [
      "Longest completed swim near 2 km",
      "Longest bike near race demands",
      "Run durability after cycling",
      "Brick-session experience",
      "Transition practice",
      "Race-fueling practice",
      "Key preparation sessions completed",
    ],
  },
  {
    slug: "ironman_70_3",
    name: "Ironman 70.3",
    discipline: "triathlon",
    swimM: 1900,
    bikeM: 90000,
    runM: 21100,
    distanceM: 113000,
    minPrepWeeks: 16,
    phases: [
      { phase: "base", weeksHint: 5, focus: "Base across three sports" },
      { phase: "build", weeksHint: 7, focus: "Long bricks" },
      { phase: "peak", weeksHint: 2, focus: "Specificity" },
      { phase: "taper", weeksHint: 2, focus: "Taper" },
      { phase: "recovery", weeksHint: 2, focus: "Recovery" },
    ],
    readinessChecks: ["Long sessions completed", "Brick experience", "Fueling practice", "Consistency"],
  },
  {
    slug: "ironman",
    name: "Full-distance triathlon",
    discipline: "triathlon",
    swimM: 3800,
    bikeM: 180000,
    runM: 42200,
    distanceM: 226000,
    minPrepWeeks: 24,
    phases: [
      { phase: "base", weeksHint: 8, focus: "Large aerobic base" },
      { phase: "build", weeksHint: 10, focus: "Volume and bricks" },
      { phase: "peak", weeksHint: 3, focus: "Specific long days" },
      { phase: "taper", weeksHint: 2, focus: "Taper" },
      { phase: "recovery", weeksHint: 3, focus: "Recovery" },
    ],
    readinessChecks: ["Longest sessions", "Consistency", "Fueling", "Brick experience"],
  },
];

export function findEventTemplate(slugOrName: string): EventTemplate | null {
  const key = slugOrName.trim().toLowerCase().replace(/\s+/g, "_");
  return EVENT_TEMPLATES.find((row) => row.slug === key || row.name.toLowerCase() === slugOrName.trim().toLowerCase()) ?? null;
}

export function buildPhasePlan(template: EventTemplate, weeksAvailable: number): EventTemplate["phases"] {
  if (weeksAvailable >= template.minPrepWeeks) return template.phases;
  // Do not compress into an unsafe short plan — shrink supporting phases, keep taper/recovery.
  const scale = weeksAvailable / template.minPrepWeeks;
  return template.phases.map((phase) => ({
    ...phase,
    weeksHint: Math.max(phase.phase === "taper" || phase.phase === "recovery" ? 1 : 1, Math.round(phase.weeksHint * scale)),
    focus: weeksAvailable < template.minPrepWeeks
      ? `${phase.focus} (short prep — volume stays conservative)`
      : phase.focus,
  }));
}

export function readinessEvidence(template: EventTemplate, evidence: Record<string, boolean | string | null>): Array<{ label: string; status: "met" | "missing" | "unknown"; detail: string }> {
  return template.readinessChecks.map((label) => {
    const key = label.toLowerCase();
    const hit = Object.entries(evidence).find(([name]) => key.includes(name.toLowerCase()) || name.toLowerCase().includes(key.slice(0, 12)));
    if (!hit) return { label, status: "unknown" as const, detail: "Not enough logged evidence yet." };
    const value = hit[1];
    if (value === true || (typeof value === "string" && value.trim())) {
      return { label, status: "met" as const, detail: typeof value === "string" ? value : "Recorded." };
    }
    return { label, status: "missing" as const, detail: "Not yet demonstrated in logs." };
  });
}
