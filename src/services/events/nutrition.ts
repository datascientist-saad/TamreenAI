/**
 * Event-specific nutrition planner.
 * Integrates with existing calorie targets; does not overwrite meal plans silently.
 * No universal fluid/sodium targets; carb loading only when justified.
 */

import type { EventPriority } from "./catalog";
import type { PlanningEvent } from "./multi-event";
import type { EventPhaseType } from "./periodization";

export type EventNutritionPlan = {
  eventId: string;
  eventName: string;
  phase: EventPhaseType | "prep";
  carbLoadingRecommended: boolean;
  sections: Array<{
    id: "pre" | "morning" | "during" | "hydration" | "post";
    title: string;
    bullets: string[];
  }>;
  dailyHints: {
    energyEmphasis: "normal" | "carb_available" | "carb_load" | "recovery";
    proteinEmphasis: "normal" | "elevated";
    hydrationEmphasis: "normal" | "elevated";
  };
  limitations: string[];
  factors: Array<{ label: string; detail: string }>;
};

function demandHours(event: PlanningEvent): number {
  if (event.goalTimeSeconds && event.goalTimeSeconds > 0) return event.goalTimeSeconds / 3600;
  const demand =
    [event.swimM, event.bikeM, event.runM].filter((v): v is number => v != null).reduce((s, v) => s + v, 0)
    || event.distanceM
    || 0;
  if (demand >= 200_000) return 12;
  if (demand >= 100_000) return 5.5;
  if (demand >= 40_000) return 3.5;
  if (demand >= 21_000) return 2;
  if (demand >= 10_000) return 1;
  return 0.75;
}

function isEndurance(event: PlanningEvent): boolean {
  return event.discipline === "triathlon"
    || event.discipline === "running"
    || event.discipline === "cycling"
    || event.discipline === "swimming"
    || (event.distanceM ?? 0) >= 5000;
}

/**
 * Build event nutrition guidance for the athlete's current phase.
 * Carb loading only for longer endurance efforts (typically ≥90 min) on A/B events near race week.
 */
export function buildEventNutritionPlan(input: {
  event: PlanningEvent;
  phase: EventPhaseType | "prep";
  daysUntil: number;
  dietaryPattern?: string | null;
  allergies?: string[] | null;
  experienceLevel?: string | null;
}): EventNutritionPlan {
  const { event, phase, daysUntil } = input;
  const hours = demandHours(event);
  const factors: Array<{ label: string; detail: string }> = [
    { label: "Estimated duration", detail: `~${hours.toFixed(1)} hours based on goal time or distance.` },
    { label: "Phase", detail: String(phase) },
  ];
  const limitations: string[] = [
    "Guidance is educational and must fit your GI tolerance and medical needs.",
    "Fluid and electrolyte needs vary with heat, sweat rate, and body size — no universal mg/L target is used.",
  ];
  if (input.allergies?.length) {
    limitations.push(`Respect allergies: ${input.allergies.join(", ")}.`);
  }
  if (input.dietaryPattern && input.dietaryPattern !== "none") {
    factors.push({ label: "Dietary pattern", detail: input.dietaryPattern });
  }

  const longEnoughForLoading = hours >= 1.5 && event.priority !== "practice";
  const inLoadWindow = daysUntil >= 0 && daysUntil <= 3 && (phase === "taper" || phase === "event" || phase === "peak");
  const carbLoadingRecommended = Boolean(longEnoughForLoading && inLoadWindow && isEndurance(event));
  if (!carbLoadingRecommended) {
    factors.push({ label: "Carb loading", detail: "Not prescribed — duration, priority, or timing does not justify a loading protocol." });
  } else {
    factors.push({ label: "Carb loading", detail: "Justified for this endurance effort in the final days — raise carbohydrate availability with familiar foods." });
  }

  const sections: EventNutritionPlan["sections"] = [];

  sections.push({
    id: "pre",
    title: "Pre-event fueling",
    bullets: [
      carbLoadingRecommended
        ? "In the final 24–48 hours, emphasize familiar carbohydrate-rich meals without experimenting with new foods."
        : "Keep daily carbohydrate availability matched to training; no special loading protocol.",
      "Maintain usual protein intake; do not slash fat so low that meals become unfamiliar.",
      input.dietaryPattern === "halal" ? "Choose halal-certified options you already tolerate." : "Use foods you have practiced in training.",
    ],
  });

  sections.push({
    id: "morning",
    title: "Race-morning meal",
    bullets: [
      hours >= 2
        ? "Eat a practiced carbohydrate-focused meal 2–3 hours before the start when schedule allows."
        : "A smaller practiced snack 60–90 minutes before the start is usually enough for shorter events.",
      "Avoid high-fiber or novel foods that have caused GI issues in training.",
      "Sip fluids with the meal; do not force a fixed litre target.",
    ],
  });

  if (isEndurance(event) && hours >= 1) {
    const carbPerHour =
      hours >= 3 ? "60–90 g carbohydrate per hour when tolerated"
        : hours >= 1.5 ? "30–60 g carbohydrate per hour when tolerated"
          : "Optional small carbohydrate top-ups if the effort exceeds ~60 minutes";
    sections.push({
      id: "during",
      title: "During-event fueling",
      bullets: [
        `Estimate: ${carbPerHour}. Practice this in long sessions first.`,
        "Use products and flavors already tested — race day is not for experiments.",
        event.discipline === "triathlon"
          ? "Plan feeds primarily on the bike; keep run fuels simple and practiced."
          : "Space intakes evenly rather than taking everything at once.",
      ],
    });
  } else {
    sections.push({
      id: "during",
      title: "During-event fueling",
      bullets: [
        "For this duration, mid-event fueling is usually unnecessary beyond water if thirsty.",
        "Strength competitions: small snacks between attempts only if they settle the stomach.",
      ],
    });
  }

  sections.push({
    id: "hydration",
    title: "Hydration strategy",
    bullets: [
      "Drink to thirst and to conditions (heat, humidity, altitude) rather than a universal ml/h rule.",
      "Include electrolytes in longer efforts or heavy sweat conditions using products you tolerate.",
      "If you know your sweat rate from training, use that; otherwise stay conservative and avoid overdrinking.",
    ],
  });

  sections.push({
    id: "post",
    title: "Post-event recovery nutrition",
    bullets: [
      "Begin with fluids and a carbohydrate + protein meal or snack within a few hours.",
      "Prioritize protein for repair and carbohydrates to replenish glycogen after long endurance efforts.",
      "Continue normal meals across the next day; do not force a huge surplus if appetite is low.",
    ],
  });

  const dailyHints: EventNutritionPlan["dailyHints"] = {
    energyEmphasis: phase === "recovery" || phase === "return"
      ? "recovery"
      : carbLoadingRecommended
        ? "carb_load"
        : phase === "taper" || phase === "event"
          ? "carb_available"
          : "normal",
    proteinEmphasis: phase === "recovery" ? "elevated" : "normal",
    hydrationEmphasis: phase === "event" || phase === "taper" ? "elevated" : "normal",
  };

  return {
    eventId: event.id,
    eventName: event.name,
    phase,
    carbLoadingRecommended,
    sections,
    dailyHints,
    limitations,
    factors,
  };
}

/** Map nutrition plan into event_preparation.fueling_practice jsonb shape. */
export function fuelingPracticePayload(plan: EventNutritionPlan): Record<string, unknown> {
  return {
    version: 1,
    carbLoadingRecommended: plan.carbLoadingRecommended,
    dailyHints: plan.dailyHints,
    sections: plan.sections,
    limitations: plan.limitations,
    factors: plan.factors,
    updatedAt: new Date().toISOString(),
  };
}
