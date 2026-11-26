/**
 * Multi-event compatibility using deterministic, explainable rules.
 * Statuses: Compatible | Needs Attention | High Conflict
 * No arbitrary percentage scores.
 */

import type { EventPriority } from "./catalog";
import type { PlanningEvent } from "./multi-event";
import { detectEventConflicts } from "./multi-event";
import { detectScheduleOverlaps } from "./policy";

export type CompatibilityStatus = "Compatible" | "Needs Attention" | "High Conflict";

export type CompatibilityFinding = {
  severity: "info" | "warning" | "high";
  title: string;
  detail: string;
  eventIds: string[];
};

export type CompatibilityReport = {
  status: CompatibilityStatus;
  findings: CompatibilityFinding[];
  summary: string;
};

function gapDays(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

function demand(event: PlanningEvent): number {
  const parts = [event.swimM, event.bikeM, event.runM].filter((v): v is number => v != null);
  if (parts.length) return parts.reduce((s, v) => s + v, 0);
  return event.distanceM ?? 0;
}

/**
 * Evaluate the athlete's active event set for scheduling compatibility.
 */
export function evaluateEventCompatibility(events: PlanningEvent[]): CompatibilityReport {
  const findings: CompatibilityFinding[] = [];
  const sorted = [...events].sort((a, b) => a.startsOn.localeCompare(b.startsOn));

  // Reuse base conflict detector, then enrich with IDs and extra rules.
  for (const base of detectEventConflicts(sorted)) {
    findings.push({
      severity: base.severity,
      title: base.title,
      detail: base.detail,
      eventIds: sorted.map((e) => e.id),
    });
  }

  for (const overlap of detectScheduleOverlaps(sorted)) {
    findings.push({
      severity: overlap.severity,
      title: overlap.title,
      detail: `${overlap.detail} Overlap dates: ${overlap.dates.join(", ")}.`,
      eventIds: overlap.eventIds,
    });
  }

  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      const a = sorted[i];
      const b = sorted[j];
      const gap = gapDays(a.startsOn, b.startsOn);

      if (gap === 0) {
        findings.push({
          severity: "high",
          title: "Same-day events",
          detail: `${a.name} and ${b.name} share a calendar day. Only one can be the primary activity; the other needs rescheduling or cancellation.`,
          eventIds: [a.id, b.id],
        });
      } else if (gap === 1 && a.priority !== "practice" && b.priority !== "practice") {
        findings.push({
          severity: "high",
          title: "Consecutive competition days",
          detail: `${a.name} and ${b.name} fall on consecutive days. Recovery between them is insufficient for scoring races.`,
          eventIds: [a.id, b.id],
        });
      }

      const combined = demand(a) + demand(b);
      if (gap > 0 && gap <= 10 && combined >= 60_000 && a.priority !== "practice" && b.priority !== "practice") {
        findings.push({
          severity: "warning",
          title: "Excessive combined event load",
          detail: `${a.name} and ${b.name} combine ~${Math.round(combined / 1000)} km within ${gap} days.`,
          eventIds: [a.id, b.id],
        });
      }

      // Secondary taper overlapping primary peak/taper window (~21d before A).
      if (a.priority === "primary" && b.priority === "secondary") {
        const beforeA = gapDays(b.startsOn, a.startsOn);
        if (beforeA > 0 && beforeA <= 21) {
          findings.push({
            severity: "warning",
            title: "Secondary race inside primary taper window",
            detail: `${b.name} sits ${beforeA} days before primary ${a.name}. Keep B taper short so A preparation is not compromised.`,
            eventIds: [a.id, b.id],
          });
        }
      }
      if (b.priority === "primary" && a.priority === "secondary") {
        const beforeB = gapDays(a.startsOn, b.startsOn);
        if (beforeB > 0 && beforeB <= 21) {
          findings.push({
            severity: "warning",
            title: "Secondary race inside primary taper window",
            detail: `${a.name} sits ${beforeB} days before primary ${b.name}. Keep B taper short so A preparation is not compromised.`,
            eventIds: [a.id, b.id],
          });
        }
      }
    }
  }

  // Deduplicate by title+detail
  const unique = new Map<string, CompatibilityFinding>();
  for (const finding of findings) {
    const key = `${finding.title}|${finding.detail}`;
    if (!unique.has(key)) unique.set(key, finding);
  }
  const list = [...unique.values()];
  const hasHigh = list.some((f) => f.severity === "high");
  const hasWarn = list.some((f) => f.severity === "warning");
  const status: CompatibilityStatus = hasHigh ? "High Conflict" : hasWarn ? "Needs Attention" : "Compatible";
  const summary =
    status === "Compatible"
      ? "Events can share one integrated schedule without major conflict."
      : status === "Needs Attention"
        ? "Some events need careful taper or recovery management. Review recommendations before accepting plan changes."
        : "Serious scheduling conflicts exist. Change priorities or dates before stacking hard preparation.";

  return { status, findings: list, summary };
}

export function compatibilityForPriorityChange(
  events: PlanningEvent[],
  eventId: string,
  nextPriority: EventPriority,
): CompatibilityReport {
  const adjusted = events.map((event) => (event.id === eventId ? { ...event, priority: nextPriority } : event));
  return evaluateEventCompatibility(adjusted);
}
