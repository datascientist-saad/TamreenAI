import Link from "next/link";
import { PageFrame } from "@/components/page";
import { PlanPreviewConfirm } from "@/features/onboarding/preview-confirm";
import { recommendSportPriorities, weeklyBalanceHint } from "@/services/training/priorities";
import { ageFromDob, computeDailyTargets, mapGoalSlug } from "@/services/nutrition/calories";
import { todayInTimeZone } from "@/lib/utils";
import { requireUser } from "@/server/guard";

export default async function OnboardingPreviewPage() {
  const { supabase, user } = await requireUser();
  const today = todayInTimeZone("Asia/Qatar");
  const [{ data: profile }, { data: athlete }, { data: prefs }, { data: sports }, { data: goals }, { data: plan }, { data: workouts }, { data: event }] = await Promise.all([
    supabase.from("profiles").select("full_name, date_of_birth, sex, onboarding_completed").eq("id", user.id).maybeSingle(),
    supabase.from("athlete_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("athlete_preferences").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("athlete_sports").select("priority_class, is_primary, sports(slug, name)").eq("user_id", user.id),
    supabase.from("athlete_goals").select("is_primary, goals(slug, name)").eq("user_id", user.id),
    supabase.from("training_plans").select("id, name, status, explanation, start_date, end_date, primary_goal_slug").eq("user_id", user.id).eq("status", "draft").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("workouts").select("scheduled_date, sport, title, duration_min, importance, intensity").eq("user_id", user.id).eq("status", "planned").is("deleted_at", null).order("scheduled_date").limit(21),
    supabase.from("events").select("name, starts_on, event_type").eq("owner_user_id", user.id).is("deleted_at", null).order("starts_on").limit(1).maybeSingle(),
  ]);

  if (!plan) {
    return (
      <PageFrame eyebrow="Plan preview" title="No draft plan yet" lede="Finish onboarding to generate a preview you can confirm before activation.">
        <Link className="btn btn-primary w-fit" href="/onboarding">Continue onboarding</Link>
      </PageFrame>
    );
  }

  const sportSlugs = (sports ?? []).flatMap((row) => {
    const joined = row.sports as { slug?: string } | { slug?: string }[] | null;
    const slug = Array.isArray(joined) ? joined[0]?.slug : joined?.slug;
    return slug ? [slug] : [];
  });
  const primaryGoal = plan.primary_goal_slug || "endurance";
  const priorities = recommendSportPriorities({
    sports: sportSlugs,
    primaryGoal,
    eventType: event?.event_type ?? null,
  });
  const missing: string[] = [];
  if (athlete?.ftp_watts == null && (sportSlugs.includes("cycling") || sportSlugs.includes("triathlon"))) missing.push("Cycling FTP or aerobic ride assessment");
  if (athlete?.reported_5k_seconds == null && (sportSlugs.includes("running") || sportSlugs.includes("triathlon"))) missing.push("Running capability / recent race");
  if (athlete?.swim_100m_seconds == null && (sportSlugs.includes("swimming") || sportSlugs.includes("triathlon"))) missing.push("Swim pace");
  if (!prefs?.health_data_consent) missing.push("Health-data consent (needed for Health module writes)");

  let nutritionNote = "Height, weight, and date of birth are required before calorie targets are calculated.";
  if (athlete?.weight_kg && athlete?.height_cm && profile?.date_of_birth) {
    const age = ageFromDob(profile.date_of_birth, today);
    if (age != null) {
      const targets = computeDailyTargets({
        weightKg: Number(athlete.weight_kg),
        heightCm: Number(athlete.height_cm),
        ageYears: age,
        sex: (profile.sex as "female" | "male" | "other" | "prefer_not_to_say" | null) ?? null,
        dayType: "training",
        primaryGoal: mapGoalSlug(primaryGoal),
      });
      nutritionNote = `Estimated training-day target ~${targets.caloriesKcal} kcal (P ${targets.proteinG}g / C ${targets.carbsG}g / F ${targets.fatG}g). ${targets.limitations[0] ?? "Deterministic estimate — confirm in Nutrition."}`;
    }
  }

  const week = (workouts ?? []).slice(0, 14);

  return (
    <PageFrame eyebrow="Athlete plan preview" title="Confirm before activation" lede="Review the draft. Nothing becomes the active plan until you confirm. You can edit onboarding later without erasing completed workouts.">
      <section className="app-card grid gap-2 p-4">
        <h2 className="font-bold">Athlete summary</h2>
        <p className="text-sm">{profile?.full_name || "Athlete"} · {athlete?.experience_level} · {sportSlugs.join(", ") || "no sports"}</p>
        <p className="text-sm text-muted">{athlete?.height_cm ?? "—"} cm · {athlete?.weight_kg ?? "—"} kg · diet {prefs?.dietary_pattern ?? "none"} · nutrition {prefs?.nutrition_mode ?? "flexible"} · schedule {prefs?.scheduling_mode ?? "adaptive"}</p>
        <p className="text-sm">Primary goal: {primaryGoal.replaceAll("_", " ")}</p>
      </section>

      <section className="app-card grid gap-2 p-4">
        <h2 className="font-bold">Sport priorities</h2>
        <p className="text-sm text-muted">{weeklyBalanceHint(priorities, athlete?.minutes_per_day ?? 60, athlete?.preferred_days?.length ?? 5)}</p>
        <ul className="grid gap-1 text-sm">
          {priorities.map((row) => (
            <li key={row.sport}><span className="font-semibold capitalize">{row.sport}</span> · {row.priority} — {row.reason}</li>
          ))}
        </ul>
      </section>

      <section className="app-card grid gap-2 p-4">
        <h2 className="font-bold">Proposed week structure</h2>
        <p className="text-sm text-muted">{plan.name} · {plan.start_date} → {plan.end_date}</p>
        <p className="text-sm">{plan.explanation}</p>
        <ul className="mt-2 grid gap-1 text-sm">
          {week.map((workout) => (
            <li key={`${workout.scheduled_date}-${workout.title}`}>{workout.scheduled_date} · {workout.sport} · {workout.title} · {workout.duration_min} min · {workout.importance}</li>
          ))}
        </ul>
      </section>

      <section className="app-card grid gap-2 p-4">
        <h2 className="font-bold">Nutrition estimate</h2>
        <p className="text-sm">{nutritionNote}</p>
      </section>

      {event ? (
        <section className="app-card grid gap-2 p-4">
          <h2 className="font-bold">Event preparation</h2>
          <p className="text-sm">{event.name} on {event.starts_on} ({event.event_type}). Phase lengths will follow available time without unsafe compression.</p>
        </section>
      ) : null}

      <section className="app-card grid gap-2 p-4">
        <h2 className="font-bold">Missing information & confidence limits</h2>
        {missing.length ? (
          <ul className="list-disc pl-5 text-sm text-muted">
            {missing.map((item) => <li key={item}>{item}</li>)}
          </ul>
        ) : <p className="text-sm text-muted">Core profile fields are present. Benchmarks still improve confidence when added later.</p>}
        <p className="text-sm text-muted">Fitness level is not assumed. Blank benchmarks stay blank.</p>
      </section>

      <PlanPreviewConfirm />
      <Link className="btn btn-ghost w-fit" href="/onboarding">Edit onboarding answers</Link>
    </PageFrame>
  );
}
