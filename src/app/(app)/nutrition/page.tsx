import Link from "next/link";
import { Droplets, Utensils } from "lucide-react";
import { PageFrame } from "@/components/page";
import { ProgressIndicator } from "@/components/ui/progress-indicator";
import { NutritionLogger } from "@/features/nutrition/logger";
import { todayInTimeZone } from "@/lib/utils";
import { requireUser } from "@/server/guard";

const mealOrder = ["breakfast", "lunch", "dinner", "snack", "snacks"] as const;

export default async function NutritionPage() {
  const { supabase, user } = await requireUser();
  const { data: athlete } = await supabase.from("athlete_profiles").select("timezone").eq("user_id", user.id).maybeSingle();
  const today = todayInTimeZone(athlete?.timezone || "Asia/Qatar");
  const [{ data: prefs }, { data: target }, { data: entries }, { data: hydration }, { data: foods }, { data: workouts }, { data: upcomingEvent }] = await Promise.all([
    supabase.from("athlete_preferences").select("nutrition_mode, dietary_pattern, allergies").eq("user_id", user.id).maybeSingle(),
    supabase.from("nutrition_targets").select("*").eq("user_id", user.id).eq("target_date", today).maybeSingle(),
    supabase.from("food_entries").select("id, food_name, meal_slot, calories_kcal, protein_g, carbs_g, fat_g, entry_method, confirmed").eq("user_id", user.id).eq("logged_on", today).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("hydration_entries").select("amount_ml").eq("user_id", user.id).eq("logged_on", today),
    supabase.from("food_catalog").select("id, name, brand, serving_label, calories_kcal, protein_g, carbs_g, fat_g, is_halal, barcode").order("name").limit(200),
    supabase.from("workouts").select("title, scheduled_date, duration_min, sport, intensity").eq("user_id", user.id).eq("scheduled_date", today).eq("status", "planned").is("deleted_at", null),
    supabase
      .from("events")
      .select("id, name, starts_on, priority, event_preparation(fueling_practice)")
      .eq("owner_user_id", user.id)
      .eq("status", "active")
      .is("deleted_at", null)
      .gte("starts_on", today)
      .order("starts_on")
      .limit(1)
      .maybeSingle(),
  ]);
  const prepRow = Array.isArray(upcomingEvent?.event_preparation)
    ? upcomingEvent?.event_preparation[0]
    : upcomingEvent?.event_preparation;
  const fueling = prepRow && typeof prepRow === "object" && prepRow.fueling_practice && typeof prepRow.fueling_practice === "object"
    ? prepRow.fueling_practice as { sections?: Array<{ id: string; title: string; bullets: string[] }>; carbLoadingRecommended?: boolean }
    : null;

  const eaten = {
    calories: (entries ?? []).reduce((sum, row) => sum + Number(row.calories_kcal ?? 0), 0),
    protein: (entries ?? []).reduce((sum, row) => sum + Number(row.protein_g ?? 0), 0),
    carbs: (entries ?? []).reduce((sum, row) => sum + Number(row.carbs_g ?? 0), 0),
    fat: (entries ?? []).reduce((sum, row) => sum + Number(row.fat_g ?? 0), 0),
  };
  const water = (hydration ?? []).reduce((sum, row) => sum + Number(row.amount_ml ?? 0), 0);
  const mode = prefs?.nutrition_mode ?? "flexible";
  const calorieTarget = target ? Number(target.calories_kcal) : 0;
  const remaining = target ? Math.max(0, calorieTarget - Math.round(eaten.calories)) : null;

  const byMeal = new Map<string, NonNullable<typeof entries>>();
  for (const entry of entries ?? []) {
    const slot = (entry.meal_slot || "snacks").toLowerCase();
    const key = slot.startsWith("snack") ? "snacks" : slot;
    const list = byMeal.get(key) ?? [];
    list.push(entry);
    byMeal.set(key, list);
  }

  return (
    <PageFrame
      title="Nutrition"
      lede={mode === "flexible" ? "Log intake against today's target." : "Follow the structured plan and log swaps."}
      compact
      actions={<Link className="btn btn-ghost btn-sm" href="/recovery">Body</Link>}
    >
      <p className="caption">
        {prefs?.dietary_pattern ?? "Diet not set"}
        {prefs?.allergies?.length ? ` · Allergies: ${prefs.allergies.join(", ")}` : ""}
      </p>

      <section className="app-card grid gap-4 p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Calories</p>
            <p className="metric mt-1 text-3xl font-bold">
              {Math.round(eaten.calories)}
              {target ? <span className="text-base font-semibold text-muted"> / {calorieTarget}</span> : null}
            </p>
            {remaining != null ? <p className="caption mt-1">{remaining} kcal remaining</p> : null}
          </div>
          <Droplets size={18} className="mb-1 text-muted" strokeWidth={1.75} aria-hidden />
        </div>
        {target ? (
          <div className="grid gap-3">
            <ProgressIndicator value={eaten.calories} max={Math.max(calorieTarget, 1)} label="Calories" />
            <ProgressIndicator value={eaten.protein} max={Math.max(Number(target.protein_g) || 1, 1)} label={`Protein ${Math.round(eaten.protein)}/${Math.round(Number(target.protein_g))}g`} />
            <ProgressIndicator value={eaten.carbs} max={Math.max(Number(target.carbs_g) || 1, 1)} label={`Carbs ${Math.round(eaten.carbs)}/${Math.round(Number(target.carbs_g))}g`} />
            <ProgressIndicator value={eaten.fat} max={Math.max(Number(target.fat_g) || 1, 1)} label={`Fat ${Math.round(eaten.fat)}/${Math.round(Number(target.fat_g))}g`} />
            <ProgressIndicator value={water} max={Math.max(Number(target.hydration_ml) || 1, 1)} label={`Hydration ${water}/${target.hydration_ml ?? "—"} ml`} tone="success" />
          </div>
        ) : (
          <p className="text-sm text-muted">No target yet. Recalculate after height, weight, and date of birth are saved.</p>
        )}
      </section>

      {target ? (
        <details className="app-card p-4 text-sm">
          <summary className="cursor-pointer font-semibold">How today&apos;s target was built</summary>
          <p className="mt-2 text-muted">{target.explanation}</p>
          <p className="mt-2 caption">BMR {target.bmr_kcal} · TDEE {target.tdee_kcal} · Exercise {target.exercise_kcal} · Goal adj {target.goal_adjustment_kcal}</p>
        </details>
      ) : null}

      {upcomingEvent && fueling?.sections?.length ? (
        <section className="app-card grid gap-3 p-4">
          <h2 className="flex items-center gap-2 section-title"><Utensils size={16} strokeWidth={1.75} aria-hidden /> {upcomingEvent.name} — race nutrition</h2>
          <p className="caption">
            {upcomingEvent.starts_on}
            {fueling.carbLoadingRecommended ? " · Carb loading justified in final days" : " · No loading protocol"}
          </p>
          <div className="grid gap-2">
            {fueling.sections.slice(0, 5).map((section) => (
              <details key={section.id} className="rounded-xl bg-paper px-3 py-2 text-sm">
                <summary className="cursor-pointer font-semibold">{section.title}</summary>
                <ul className="mt-2 grid gap-1 text-muted">
                  {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                </ul>
              </details>
            ))}
          </div>
          <Link className="btn btn-ghost btn-sm" href={`/events/${upcomingEvent.id}`}>Event preparation</Link>
        </section>
      ) : null}

      {(workouts ?? []).length ? (
        <section className="app-card p-4">
          <h2 className="flex items-center gap-2 section-title"><Utensils size={16} strokeWidth={1.75} aria-hidden /> Training fueling</h2>
          <ul className="mt-2 grid gap-1 text-sm text-muted">
            {(workouts ?? []).map((workout) => (
              <li key={`${workout.title}-${workout.sport}`}>
                {workout.title} · {workout.duration_min} min {workout.sport}
                {workout.intensity ? ` · ${workout.intensity}` : ""}. Prefer familiar carbs before hard work.
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="app-card grid gap-3 p-4">
        <h2 className="section-title">Log food</h2>
        <NutritionLogger foods={(foods ?? []).map((food) => ({
          id: food.id,
          name: food.name,
          brand: food.brand,
          serving_label: food.serving_label,
          calories_kcal: Number(food.calories_kcal),
          protein_g: Number(food.protein_g),
          carbs_g: Number(food.carbs_g),
          fat_g: Number(food.fat_g),
          is_halal: food.is_halal,
          barcode: food.barcode,
        }))} />
      </section>

      <section className="grid gap-3">
        <h2 className="section-title">Today&apos;s meals</h2>
        {mealOrder.filter((slot) => slot !== "snack").map((slot) => {
          const rows = byMeal.get(slot) ?? [];
          return (
            <div key={slot} className="app-card overflow-hidden">
              <div className="border-b border-line px-4 py-2.5">
                <h3 className="text-sm font-bold capitalize">{slot}</h3>
              </div>
              {rows.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted">Nothing logged</p>
              ) : (
                <ul className="divide-y divide-line">
                  {rows.map((entry) => (
                    <li key={entry.id} className="px-4 py-3 text-sm">
                      <span className="font-semibold">{entry.food_name}</span>
                      <span className="caption mt-0.5 block">
                        {Math.round(Number(entry.calories_kcal))} kcal · P{Math.round(Number(entry.protein_g))} C{Math.round(Number(entry.carbs_g))} F{Math.round(Number(entry.fat_g))}
                        {entry.confirmed ? "" : " · unconfirmed"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </section>
    </PageFrame>
  );
}
