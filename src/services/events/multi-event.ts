import { eventSportsDemand, type EventPriority } from "@/services/events/catalog";

export type PlanningEvent = {
  id: string;
  name: string;
  startsOn: string;
  priority: EventPriority;
  discipline: string;
  eventType: string;
  distanceM: number | null;
  swimM: number | null;
  bikeM: number | null;
  runM: number | null;
  goalTimeSeconds: number | null;
  sports: Array<"running" | "cycling" | "swimming" | "strength">;
};

type RawEvent = {
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
};

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asPriority(value: unknown): EventPriority {
  if (value === "secondary" || value === "practice" || value === "primary") return value;
  return "primary";
}

export function toPlanningEvents(rows: RawEvent[], today: string): PlanningEvent[] {
  return rows
    .filter((row) => (row.status ?? "active") === "active" && row.starts_on >= today)
    .map((row) => {
      const course = row.course && typeof row.course === "object" ? row.course : {};
      const swimM = asNumber(row.swim_m) ?? asNumber(course.swim_m);
      const bikeM = asNumber(row.bike_m) ?? asNumber(course.bike_m);
      const runM = asNumber(row.run_m) ?? asNumber(course.run_m);
      const distanceM = asNumber(row.distance_m);
      const discipline = row.discipline || row.event_type || "other";
      const priority = asPriority(row.priority ?? course.priority);
      return {
        id: row.id,
        name: row.name,
        startsOn: row.starts_on,
        priority,
        discipline,
        eventType: row.event_type || discipline,
        distanceM,
        swimM,
        bikeM,
        runM,
        goalTimeSeconds: asNumber(row.goal_time_seconds),
        sports: eventSportsDemand({ distanceM, swimM, bikeM, runM, templateSlug: null }, discipline),
      };
    })
    .sort((a, b) => {
      const priorityRank = { primary: 0, secondary: 1, practice: 2 } as const;
      const byPriority = priorityRank[a.priority] - priorityRank[b.priority];
      if (byPriority !== 0) return byPriority;
      return a.startsOn.localeCompare(b.startsOn);
    });
}

/** Primary event if present, otherwise soonest active event. */
export function pickAnchorEvent(events: PlanningEvent[]): PlanningEvent | null {
  return events.find((event) => event.priority === "primary") ?? events[0] ?? null;
}

export function detectEventConflicts(events: PlanningEvent[]): Array<{ severity: "info" | "warning" | "high"; title: string; detail: string }> {
  const findings: Array<{ severity: "info" | "warning" | "high"; title: string; detail: string }> = [];
  const primaries = events.filter((event) => event.priority === "primary");
  if (primaries.length > 1) {
    findings.push({
      severity: "warning",
      title: "Multiple primary events",
      detail: `${primaries.map((event) => event.name).join(" and ")} are both marked primary. The earliest primary anchors the taper; others stay secondary support.`,
    });
  }
  for (let i = 0; i < events.length; i += 1) {
    for (let j = i + 1; j < events.length; j += 1) {
      const a = events[i];
      const b = events[j];
      const gapDays = Math.round((Date.parse(`${b.startsOn}T00:00:00Z`) - Date.parse(`${a.startsOn}T00:00:00Z`)) / 86_400_000);
      if (gapDays >= 0 && gapDays < 14 && a.priority !== "practice" && b.priority !== "practice") {
        findings.push({
          severity: gapDays < 7 ? "high" : "warning",
          title: "Tight event spacing",
          detail: `${a.name} and ${b.name} are ${gapDays} days apart. Recovery between them is protected; volume will not be doubled to satisfy both.`,
        });
      }
      if (gapDays >= 0 && gapDays <= 21 && a.priority === "primary" && b.priority === "primary") {
        findings.push({
          severity: "high",
          title: "Conflicting tapers",
          detail: `Two primary events fall within three weeks. The later race is treated as secondary for scheduling until priorities change.`,
        });
      }
    }
  }
  return findings;
}

export function eventsSupportedBySport(events: PlanningEvent[], sport: string): PlanningEvent[] {
  if (sport === "brick") {
    return events.filter((event) => event.sports.includes("running") || event.sports.includes("cycling") || event.discipline === "triathlon");
  }
  if (sport === "strength" || sport === "bodybuilding" || sport === "mobility" || sport === "recovery") {
    return events;
  }
  return events.filter((event) => event.sports.includes(sport as PlanningEvent["sports"][number]) || event.sports.length === 0);
}

export function multiEventExplanation(events: PlanningEvent[], conflicts: ReturnType<typeof detectEventConflicts>): string {
  if (!events.length) return "";
  const names = events.map((event) => `${event.name} (${event.priority})`).join(", ");
  const conflictText = conflicts.length
    ? ` Conflicts noted: ${conflicts.map((item) => item.detail).join(" ")}`
    : " Shared sessions can support more than one event so the week is not duplicated.";
  return `Active events in one schedule: ${names}.${conflictText}`;
}
