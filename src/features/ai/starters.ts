import type { CoachStarter } from "@/features/ai/types";

/** Build up to two contextual starter questions for an empty coach thread. */
export function buildCoachStarters(input: {
  hasPlanChange?: boolean;
  eventName?: string | null;
  todayWorkoutTitle?: string | null;
}): CoachStarter[] {
  const starters: CoachStarter[] = [];

  if (input.hasPlanChange) {
    starters.push({ id: "plan-change", label: "Why did my plan change?" });
  }

  const eventName = input.eventName?.trim();
  if (eventName && starters.length < 2) {
    starters.push({
      id: "event-prep",
      label: `Help me prepare for my ${eventName}.`,
    });
  }

  if (starters.length < 2) {
    const workout = input.todayWorkoutTitle?.trim();
    if (workout) {
      starters.push({
        id: "today-workout",
        label: `How should I approach ${workout}?`,
      });
    } else {
      starters.push({ id: "next-workout", label: "What’s my next workout?" });
    }
  }

  if (starters.length < 2 && !input.hasPlanChange) {
    starters.push({ id: "plan-change-fallback", label: "Why did my plan change?" });
  }

  return starters.slice(0, 2);
}

export function frameCoachQuestion(
  question: string,
  context: { label: string; detail?: string } | null | undefined,
): string {
  const trimmed = question.trim();
  if (!context?.label) return trimmed;
  const detail = context.detail?.trim();
  const line = detail ? `${context.label} — ${detail}` : context.label;
  return `[Context: ${line}]\n\n${trimmed}`;
}

export function coachReplyAction(input: {
  kind?: string | null;
  eventId?: string | null;
  weekHref: string;
  from?: string | null;
}): { label: string; href: string } | null {
  const from = input.from ? `?from=${encodeURIComponent(input.from)}` : "";
  if (input.kind === "event" && input.eventId) {
    return {
      label: "Open race prep",
      href: `/events/${input.eventId}/prep${from || "?from=%2Fai"}`,
    };
  }
  if (input.kind === "week" || input.kind === "workout" || input.kind === "change") {
    return {
      label: "View this week’s plan",
      href: input.weekHref.includes("from=")
        ? input.weekHref
        : `${input.weekHref}${input.weekHref.includes("?") ? "&" : "?"}from=${encodeURIComponent(input.from || "/ai")}`,
    };
  }
  return {
    label: "View this week’s plan",
    href: `${input.weekHref}${input.weekHref.includes("?") ? "&" : "?"}from=${encodeURIComponent(input.from || "/ai")}`,
  };
}
