/**
 * Sport priority recommendations for multi-sport athletes.
 * Triathlon counts as swim+bike+run, not a fourth endurance sport.
 */

export type PriorityClass = "primary" | "secondary" | "maintenance";

export interface SportPriority {
  sport: string;
  priority: PriorityClass;
  reason: string;
}

const ENDURANCE = new Set(["running", "cycling", "swimming"]);

export function expandTrainingSports(sports: string[]): string[] {
  const set = new Set<string>();
  for (const sport of sports) {
    if (sport === "triathlon") {
      set.add("swimming");
      set.add("cycling");
      set.add("running");
      continue;
    }
    set.add(sport);
  }
  return [...set];
}

export function recommendSportPriorities(input: {
  sports: string[];
  primaryGoal: string;
  eventType?: string | null;
}): SportPriority[] {
  const expanded = expandTrainingSports(input.sports);
  const hasTri = input.sports.includes("triathlon")
    || /triathlon|t100|ironman/i.test(input.primaryGoal)
    || /triathlon|t100|ironman/i.test(input.eventType ?? "");

  return expanded.map((sport) => {
    if (sport === "strength" || sport === "bodybuilding") {
      if (/muscle|strength|recomposition|lose_fat/.test(input.primaryGoal)) {
        return { sport, priority: "primary" as const, reason: "Primary physique or strength goal." };
      }
      return { sport, priority: "secondary" as const, reason: "Supports durability beside endurance work." };
    }
    if (ENDURANCE.has(sport) && hasTri) {
      return { sport, priority: "primary" as const, reason: "Triathlon workload shares swim, bike, and run — not a fourth sport." };
    }
    if (sport === "running" && /5k|10k|marathon|endurance/.test(input.primaryGoal)) {
      return { sport, priority: "primary" as const, reason: "Matches the primary endurance goal." };
    }
    if (sport === "cycling" && /cycling|endurance/.test(input.primaryGoal)) {
      return { sport, priority: "primary" as const, reason: "Matches the primary cycling/endurance goal." };
    }
    if (sport === "swimming" && /swim|endurance/.test(input.primaryGoal)) {
      return { sport, priority: "primary" as const, reason: "Matches the primary swim/endurance goal." };
    }
    return { sport, priority: "secondary" as const, reason: "Included for balance; athlete can promote or demote." };
  });
}

export function weeklyBalanceHint(priorities: SportPriority[], minutesPerDay: number, days: number): string {
  const primary = priorities.filter((row) => row.priority === "primary");
  const total = Math.max(1, minutesPerDay * days);
  if (!primary.length) return `About ${total} minutes across the week with even sport rotation.`;
  const share = Math.round(100 / primary.length);
  return `Roughly ${share}% of key work to each primary sport (${primary.map((row) => row.sport).join(", ")}), with supporting sessions filling remaining minutes. Triathlon disciplines share the endurance budget.`;
}
