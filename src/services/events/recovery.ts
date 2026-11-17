/**
 * Post-event recovery engine.
 * Conservative when data is incomplete. Severe symptoms → medical guidance, not just deload.
 */

import type { EventPriority } from "./catalog";
import type { PlanningEvent } from "./multi-event";

export const CONCERNING_SYMPTOMS = [
  "chest_pain",
  "fainting",
  "severe_pain",
  "suspected_injury",
  "shortness_of_breath_at_rest",
] as const;

export type ConcerningSymptom = (typeof CONCERNING_SYMPTOMS)[number];

export type PostEventCheckIn = {
  completed: boolean;
  completionStatus: "finished" | "dnf" | "dns" | "partial";
  actualDistanceM?: number | null;
  finishTimeSeconds?: number | null;
  difficulty?: number | null; // 1–10
  fatigueLevel?: number | null; // 1–5
  muscleSoreness?: number | null; // 1–5
  painOrInjury?: boolean;
  sleepQuality?: number | null; // 1–5
  readyToResume?: boolean | null;
  concerningSymptoms?: ConcerningSymptom[];
  comments?: string;
};

export type RecoveryPlan = {
  recoveryDays: number;
  startDate: string;
  endDate: string;
  status: "pending_checkin" | "active" | "completed" | "skipped";
  restrictions: {
    maxIntensity: "recovery" | "easy" | "moderate";
    avoidLowerBodyStrength: boolean;
    avoidRunningQuality: boolean;
    avoidCyclingQuality: boolean;
    avoidSwimmingQuality: boolean;
    maxSessionMin: number;
    maxSessionsPerWeek: number;
  };
  recommendations: Array<{ title: string; detail: string }>;
  medicalGuidance: string;
  seekCare: boolean;
};

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function demandM(event: PlanningEvent): number {
  const parts = [event.swimM, event.bikeM, event.runM].filter((v): v is number => v != null);
  if (parts.length) return parts.reduce((s, v) => s + v, 0);
  return event.distanceM ?? 0;
}

function baseRecoveryDays(event: PlanningEvent, priority: EventPriority): number {
  const demand = demandM(event);
  if (priority === "practice") return demand >= 21_000 ? 2 : 1;
  if (priority === "secondary") {
    if (demand >= 40_000) return 7;
    if (demand >= 21_000) return 4;
    return 2;
  }
  if (demand >= 200_000) return 14;
  if (demand >= 100_000) return 10;
  if (demand >= 40_000) return 10;
  if (demand >= 21_000) return 7;
  return 3;
}

/**
 * Build recovery plan from event demands + optional check-in.
 * If check-in is missing, remains conservative and pending_checkin.
 */
export function buildPostEventRecovery(
  event: PlanningEvent,
  eventEndDate: string,
  checkIn?: PostEventCheckIn | null,
): RecoveryPlan {
  let days = baseRecoveryDays(event, event.priority);
  const recommendations: Array<{ title: string; detail: string }> = [];
  let seekCare = false;
  let medicalGuidance = "";

  const symptoms = checkIn?.concerningSymptoms ?? [];
  if (checkIn?.painOrInjury || symptoms.length) {
    const severe = symptoms.some((s) =>
      s === "chest_pain" || s === "fainting" || s === "severe_pain" || s === "shortness_of_breath_at_rest"
    );
    if (severe || checkIn?.painOrInjury) {
      seekCare = true;
      medicalGuidance =
        "Concerning symptoms or injury were reported. This is not medical care. Stop hard training and seek appropriate medical evaluation before returning. Tamreen will not clear you based on a readiness number alone.";
      days = Math.max(days, 7);
      recommendations.push({
        title: "Medical review first",
        detail: "Do not treat pain, fainting, chest pain, or suspected injury by only lowering intensity.",
      });
    }
  }

  if (!checkIn) {
    recommendations.push({
      title: "Complete post-event check-in",
      detail: "Recovery stays conservative until you report finish status, fatigue, soreness, and any pain.",
    });
    days = Math.max(days, baseRecoveryDays(event, event.priority));
  } else {
    if (checkIn.completionStatus === "dns") {
      days = Math.min(days, 2);
      recommendations.push({ title: "Did not start", detail: "Short reset only; resume normal training when ready." });
    } else if (checkIn.completionStatus === "dnf" || checkIn.completionStatus === "partial") {
      days = Math.max(days, Math.ceil(days * 0.75));
      recommendations.push({ title: "Incomplete event", detail: "Still recover — effort and stress may have been high before stopping." });
    }

    if ((checkIn.fatigueLevel ?? 3) >= 4 || (checkIn.difficulty ?? 5) >= 8) {
      days = Math.max(days, days + 2);
      recommendations.push({ title: "High fatigue", detail: "Extend easy days; avoid demanding running and heavy lower-body strength." });
    } else if ((checkIn.fatigueLevel ?? 3) <= 2 && (checkIn.difficulty ?? 5) <= 4 && event.priority === "practice") {
      days = Math.min(days, 2);
      recommendations.push({ title: "Low fatigue after training race", detail: "Shorter recovery adjustment is appropriate." });
    }

    if ((checkIn.muscleSoreness ?? 3) >= 4) {
      recommendations.push({ title: "Muscle soreness", detail: "Prefer mobility, easy cycling/swim, and skip heavy lower-body lifting early." });
    }

    if (checkIn.readyToResume === false) {
      days = Math.max(days, days + 1);
      recommendations.push({ title: "Not ready to resume", detail: "Honor athlete-reported readiness; do not force return-to-training." });
    }

    if ((checkIn.sleepQuality ?? 3) <= 2) {
      recommendations.push({ title: "Poor sleep", detail: "Prioritize sleep and keep sessions short until sleep stabilizes." });
    }
  }

  const startDate = addDays(eventEndDate, 1);
  const endDate = addDays(eventEndDate, days);

  const restrictions: RecoveryPlan["restrictions"] = {
    maxIntensity: seekCare ? "recovery" : days >= 7 ? "easy" : "moderate",
    avoidLowerBodyStrength: true,
    avoidRunningQuality: event.sports.includes("running") || event.discipline === "triathlon",
    avoidCyclingQuality: event.sports.includes("cycling") || event.discipline === "triathlon",
    avoidSwimmingQuality: event.sports.includes("swimming") || event.discipline === "triathlon",
    maxSessionMin: seekCare ? 30 : days >= 7 ? 45 : 60,
    maxSessionsPerWeek: seekCare ? 3 : days >= 7 ? 4 : 5,
  };

  recommendations.push({
    title: "Return progression",
    detail: "After recovery, rebuild volume gradually. Do not jump straight back to pre-event workload.",
  });

  return {
    recoveryDays: days,
    startDate,
    endDate,
    status: checkIn ? (seekCare ? "active" : "active") : "pending_checkin",
    restrictions,
    recommendations,
    medicalGuidance,
    seekCare,
  };
}

export type RecoveryWorkoutProposal = {
  date: string;
  title: string;
  sport: string;
  durationMin: number;
  intensity: "recovery" | "easy";
  why: string;
};

/** Suggest soft recovery activities inside the recovery window (not hard training). */
export function suggestRecoverySessions(
  plan: RecoveryPlan,
  preferredSports: string[],
): RecoveryWorkoutProposal[] {
  if (plan.seekCare) return [];
  const sessions: RecoveryWorkoutProposal[] = [];
  const sports = preferredSports.length ? preferredSports : ["mobility"];
  let cursor = plan.startDate;
  let i = 0;
  while (cursor <= plan.endDate && sessions.length < Math.min(plan.restrictions.maxSessionsPerWeek, plan.recoveryDays)) {
    if (i % 2 === 0) {
      const sport = sports[sessions.length % sports.length] === "running" && plan.restrictions.avoidRunningQuality
        ? "mobility"
        : sports[sessions.length % sports.length] || "mobility";
      sessions.push({
        date: cursor,
        title: sport === "mobility" ? "Recovery mobility" : `Easy ${sport}`,
        sport: sport === "strength" || sport === "bodybuilding" ? "mobility" : sport,
        durationMin: Math.min(plan.restrictions.maxSessionMin, 40),
        intensity: "recovery",
        why: "Post-event recovery session — keep stress low.",
      });
    }
    const next = new Date(`${cursor}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    cursor = next.toISOString().slice(0, 10);
    i += 1;
  }
  return sessions;
}
