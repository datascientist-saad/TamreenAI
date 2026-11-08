"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { disconnectStravaAccount, uploadWorkoutToStrava } from "@/services/wearables/strava-sync";
import { stravaServerConfig } from "@/services/wearables/strava-config";
import { tamreenSportToStrava } from "@/services/wearables/strava";
import { requireUser } from "./guard";

export type StravaUploadResult = { ok: boolean; code: string };

function refreshPages() {
  revalidatePath("/more");
  revalidatePath("/records");
}

export async function disconnectStravaAction() {
  const { supabase, user } = await requireUser();
  await disconnectStravaAccount(supabase, user.id);
  refreshPages();
  redirect("/more?strava=disconnected");
}

export async function uploadCompletedWorkoutToStravaAction(workoutId: string): Promise<{ ok: boolean; code: string }> {
  const { supabase, user } = await requireUser();
  const config = stravaServerConfig();
  if (!config) return { ok: false, code: "missing-config" };

  const { data: workout } = await supabase
    .from("completed_workouts")
    .select("id, sport, title, started_at, ended_at, duration_min, notes")
    .eq("id", workoutId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!workout) return { ok: false, code: "not-found" };

  const startDate = workout.started_at
    ? new Date(workout.started_at).toISOString().replace("Z", "+00:00")
    : new Date().toISOString().replace("Z", "+00:00");

  const elapsedSeconds = workout.duration_min
    ? workout.duration_min * 60
    : workout.ended_at && workout.started_at
      ? Math.round((new Date(workout.ended_at).getTime() - new Date(workout.started_at).getTime()) / 1000)
      : 3600;

  const result = await uploadWorkoutToStrava(
    supabase,
    user.id,
    {
      name: workout.title,
      sport_type: tamreenSportToStrava(workout.sport),
      start_date_local: startDate,
      elapsed_time: elapsedSeconds,
      description: workout.notes || undefined,
    },
    config,
  );

  revalidatePath("/records");
  return result;
}

export async function uploadLiveSessionToStravaAction(sessionId: string): Promise<{ ok: boolean; code: string }> {
  const { supabase, user } = await requireUser();
  const config = stravaServerConfig();
  if (!config) return { ok: false, code: "missing-config" };

  const { data: session } = await supabase
    .from("live_training_sessions")
    .select("id, exercise_slug, started_at, ended_at, duration_seconds, notes")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!session) return { ok: false, code: "not-found" };

  const startDate = session.started_at
    ? new Date(session.started_at).toISOString().replace("Z", "+00:00")
    : new Date().toISOString().replace("Z", "+00:00");

  const elapsedSeconds = session.duration_seconds
    ?? (session.ended_at && session.started_at
      ? Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000)
      : 1800);

  const name = session.exercise_slug.replaceAll("_", " ").replace(/\b\w/g, (c: string) => c.toUpperCase());

  const result = await uploadWorkoutToStrava(
    supabase,
    user.id,
    {
      name,
      sport_type: "WeightTraining",
      start_date_local: startDate,
      elapsed_time: elapsedSeconds,
      description: session.notes || undefined,
    },
    config,
  );

  return result;
}
