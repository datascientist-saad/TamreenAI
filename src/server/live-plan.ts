import { liveSlugForLibrary } from "@/services/live/catalog";
import { todayInTimeZone } from "@/lib/utils";
import { requireUser } from "./guard";

export type TodayExercise = {
  name: string;
  sets: number;
  reps: string;
  liveSlug: string | null;
};

export type TodayWorkout = {
  id: string;
  sport: string;
  title: string;
  objective: string;
  durationMin: number;
  why: string;
  status: string;
  exercises: TodayExercise[];
};

type Library = { name?: string | null; slug?: string | null; live_supported?: boolean | null } | null;

function libraryOf(value: Library | Library[]): Library {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function loadTodayLivePlan() {
  const { supabase, user } = await requireUser();
  const { data: athlete } = await supabase.from("athlete_profiles").select("timezone").eq("user_id", user.id).maybeSingle();
  const today = todayInTimeZone(athlete?.timezone || "Asia/Qatar");
  const { data } = await supabase
    .from("workouts")
    .select("id, sport, title, objective, duration_min, why_text, status, workout_exercises(sort_order, set_count, reps, notes, exercise_library(name, slug, live_supported))")
    .eq("user_id", user.id)
    .eq("scheduled_date", today)
    .is("deleted_at", null)
    .order("importance");
  const workouts: TodayWorkout[] = (data ?? []).map((workout) => ({
    id: workout.id,
    sport: workout.sport,
    title: workout.title,
    objective: workout.objective ?? "",
    durationMin: workout.duration_min,
    why: workout.why_text ?? "",
    status: workout.status,
    exercises: (workout.workout_exercises ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((row) => {
        const library = libraryOf(row.exercise_library);
        const slug = library?.slug ?? "";
        return {
          name: library?.name || row.notes?.trim() || "Exercise",
          sets: row.set_count,
          reps: row.reps,
          liveSlug: slug ? liveSlugForLibrary(slug, Boolean(library?.live_supported)) : null,
        };
      }),
  }));
  return { supabase, user, today, workouts };
}
