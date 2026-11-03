import { LIVE_EXERCISES } from "./pose";

/** Library slugs that share a camera movement with a differently named live exercise. */
const ALIASES: Record<string, string> = {
  back_squat: "squat",
  goblet_squat: "squat",
  walking_lunge: "lunge",
  split_squat: "lunge",
  step_up: "lunge",
  single_leg_rdl: "romanian_deadlift",
  lat_pulldown: "pull_up",
  dumbbell_press: "bench_press",
  dumbbell_shoulder_press: "overhead_press",
  trap_bar_deadlift: "deadlift",
  hammer_curl: "bicep_curl",
};

const LIVE = new Set(LIVE_EXERCISES.map((exercise) => exercise.slug));

export function liveSlugForLibrary(slug: string, liveSupported: boolean): string | null {
  if (!liveSupported) return null;
  const mapped = ALIASES[slug] ?? slug;
  return LIVE.has(mapped) ? mapped : null;
}

type LibraryShape = { slug?: string | null; live_supported?: boolean | null } | null;

export function workoutHasLiveCamera(
  rows: Array<{ exercise_library: LibraryShape | LibraryShape[] }> | null | undefined,
): boolean {
  return (rows ?? []).some((row) => {
    const library = Array.isArray(row.exercise_library) ? row.exercise_library[0] : row.exercise_library;
    return Boolean(library?.slug && liveSlugForLibrary(library.slug, Boolean(library.live_supported)));
  });
}
