import { liveSlugForLibrary } from "@/services/live/catalog";
import { shiftIsoDate } from "@/lib/utils";

export type PlanExercise = {
  name: string;
  sets: number;
  reps: string;
  why: string;
  liveSlug: string | null;
};

export type PlanWorkout = {
  id: string;
  scheduled_date: string;
  sport: string;
  title: string;
  objective: string;
  duration_min: number;
  intensity: string;
  expected_load: number;
  importance: string;
  recovery_hours: number;
  status: string;
  why_text: string;
  exercises: PlanExercise[];
  is_event_session?: boolean;
  event_id?: string | null;
  phase_hint?: "taper" | "deload" | "recovery" | "event" | null;
};

export type PlanBlock = {
  id: string;
  phase: string;
  name: string;
  start_date: string;
  end_date: string;
  focus: string;
};

type Library = { name?: string | null; slug?: string | null; live_supported?: boolean | null } | null;

function libraryOf(value: Library | Library[]): Library {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function toPlanWorkout(row: {
  id: string;
  scheduled_date: string;
  sport: string;
  title: string;
  objective: string | null;
  duration_min: number;
  intensity: string;
  expected_load: number | null;
  importance: string | null;
  recovery_hours: number | null;
  status: string;
  why_text: string | null;
  is_event_session?: boolean | null;
  event_id?: string | null;
  structure?: Record<string, unknown> | null;
  workout_exercises: Array<{
    sort_order: number;
    set_count: number;
    reps: string;
    why_text: string | null;
    notes: string | null;
    exercise_library: Library | Library[];
  }> | null;
}): PlanWorkout {
  const structure = row.structure && typeof row.structure === "object" ? row.structure : {};
  const taperScale = typeof structure.taperScale === "number" ? structure.taperScale : null;
  const isEvent = Boolean(row.is_event_session || structure.isEventSession);
  let phase_hint: PlanWorkout["phase_hint"] = null;
  if (isEvent) phase_hint = "event";
  else if (taperScale != null && taperScale < 0.95) phase_hint = "taper";
  else if (row.intensity === "recovery" || row.sport === "recovery" || row.sport === "mobility") phase_hint = "recovery";

  return {
    id: row.id,
    scheduled_date: row.scheduled_date,
    sport: row.sport,
    title: row.title,
    objective: row.objective ?? "",
    duration_min: row.duration_min,
    intensity: row.intensity,
    expected_load: Number(row.expected_load ?? 0),
    importance: row.importance ?? "supporting",
    recovery_hours: row.recovery_hours ?? 24,
    status: row.status,
    why_text: row.why_text ?? "",
    is_event_session: isEvent,
    event_id: row.event_id ?? (typeof structure.eventId === "string" ? structure.eventId : null),
    phase_hint,
    exercises: (row.workout_exercises ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((exercise) => {
        const library = libraryOf(exercise.exercise_library);
        const slug = library?.slug ?? "";
        return {
          name: library?.name || exercise.notes?.trim() || "Exercise",
          sets: exercise.set_count,
          reps: exercise.reps,
          why: exercise.why_text ?? "",
          liveSlug: slug ? liveSlugForLibrary(slug, Boolean(library?.live_supported)) : null,
        };
      }),
  };
}

export function planWindow(today: string, block?: { start_date: string; end_date: string }): [string, string] {
  const monthStart = `${today.slice(0, 7)}-01`;
  const monthEndDate = new Date(`${monthStart}T00:00:00Z`);
  monthEndDate.setUTCMonth(monthEndDate.getUTCMonth() + 1);
  monthEndDate.setUTCDate(0);
  const monthEnd = monthEndDate.toISOString().slice(0, 10);
  let from = monthStart;
  let to = monthEnd > shiftIsoDate(today, 41) ? monthEnd : shiftIsoDate(today, 41);
  if (block?.start_date && block.start_date < from) from = block.start_date;
  if (block?.end_date && block.end_date > to) to = block.end_date;
  const cap = shiftIsoDate(from, 120);
  if (to > cap) to = cap;
  return [from, to];
}

export function datesBetween(from: string, to: string, limit = 130): string[] {
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to && dates.length < limit) {
    dates.push(cursor);
    cursor = shiftIsoDate(cursor, 1);
  }
  return dates;
}

export function statusLabel(status: string): string {
  if (status === "skipped") return "Skipped";
  if (status === "missed") return "Missed";
  if (status === "completed") return "Done";
  if (status === "moved") return "Moved";
  return "Scheduled";
}

export function dayHeading(date: string, today: string): string {
  if (date === today) return "Today";
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
