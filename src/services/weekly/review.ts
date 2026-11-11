export interface WeeklyReviewInput {
  planned: number;
  completed: number;
  missed: number;
  skipped: number;
  loadPlanned: number;
  loadCompleted: number;
  avgFatigue: number | null;
  avgSleep: number | null;
  nutritionAdherence: number | null;
  sports: Array<{ sport: string; minutes: number }>;
  upcomingEvent: string | null;
}

export interface WeeklyReviewResult {
  summary: string;
  metrics: Record<string, unknown>;
  proposedAdjustments: Array<{ title: string; detail: string; requiresApproval: boolean }>;
  limitations: string[];
}

export function buildWeeklyReview(input: WeeklyReviewInput): WeeklyReviewResult {
  const consistency = input.planned > 0 ? Math.round((input.completed / input.planned) * 100) : null;
  const limitations: string[] = [];
  if (consistency == null) limitations.push("No planned sessions in this window.");
  if (input.avgFatigue == null) limitations.push("Fatigue check-ins were incomplete.");
  if (input.nutritionAdherence == null) limitations.push("Nutrition adherence could not be scored — targets or logs missing.");

  const proposed: WeeklyReviewResult["proposedAdjustments"] = [];
  if (input.missed > 0) {
    proposed.push({
      title: "Do not stack missed sessions",
      detail: `${input.missed} session(s) were missed. Reintroduce only key work if recovery allows.`,
      requiresApproval: true,
    });
  }
  if (input.avgFatigue != null && input.avgFatigue >= 4) {
    proposed.push({
      title: "Reduce intensity next week",
      detail: "Average fatigue was elevated. Suggest easier supporting work while protecting one key session.",
      requiresApproval: true,
    });
  }
  if (consistency != null && consistency >= 85 && (input.avgFatigue == null || input.avgFatigue <= 3)) {
    proposed.push({
      title: "Modest progression candidate",
      detail: "Consistency was strong. Any load increase should stay sport-specific and evidence-based — not a fixed percentage across all sports.",
      requiresApproval: true,
    });
  }
  if (input.upcomingEvent) {
    proposed.push({
      title: "Protect event preparation",
      detail: `Upcoming event: ${input.upcomingEvent}. Keep key sessions and taper constraints visible.`,
      requiresApproval: false,
    });
  }

  const sportLine = input.sports.length
    ? input.sports.map((row) => `${row.sport} ${row.minutes} min`).join(", ")
    : "No completed sport minutes logged.";

  return {
    summary: [
      consistency == null ? "Weekly review needs a plan to compare against." : `Completed ${input.completed}/${input.planned} planned sessions (${consistency}%).`,
      `Load completed ${Math.round(input.loadCompleted)} vs planned ${Math.round(input.loadPlanned)}.`,
      sportLine,
      input.avgSleep != null ? `Average sleep ${input.avgSleep} h.` : "Sleep average unavailable.",
    ].join(" "),
    metrics: {
      planned: input.planned,
      completed: input.completed,
      missed: input.missed,
      skipped: input.skipped,
      consistencyPct: consistency,
      loadPlanned: input.loadPlanned,
      loadCompleted: input.loadCompleted,
      avgFatigue: input.avgFatigue,
      avgSleep: input.avgSleep,
      nutritionAdherence: input.nutritionAdherence,
      sports: input.sports,
      upcomingEvent: input.upcomingEvent,
    },
    proposedAdjustments: proposed,
    limitations,
  };
}
