import { Flame, Droplets, Utensils } from "lucide-react";
import { PageFrame } from "@/components/page";
import { NutritionLogger } from "@/features/nutrition/logger";
import { todayInTimeZone } from "@/lib/utils";
import { requireUser } from "@/server/guard";

export default async function NutritionPage() {
  const { supabase, user } = await requireUser();
  const { data: athlete } = await supabase.from("athlete_profiles").select("timezone").eq("user_id", user.id).maybeSingle();
  const today = todayInTimeZone(athlete?.timezone || "Asia/Qatar");
  const [{ data: prefs }, { data: target }, { data: entries }, { data: hydration }, { data: foods }, { data: workouts }] = await Promise.all([
    supabase.from("athlete_preferences").select("nutrition_mode, dietary_pattern, allergies").eq("user_id", user.id).maybeSingle(),
    supabase.from("nutrition_targets").select("*").eq("user_id", user.id).eq("target_date", today).maybeSingle(),
    supabase.from("food_entries").select("id, food_name, meal_slot, calories_kcal, protein_g, carbs_g, fat_g, entry_method, confirmed").eq("user_id", user.id).eq("logged_on", today).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("hydration_entries").select("amount_ml").eq("user_id", user.id).eq("logged_on", today),
    supabase.from("food_catalog").select("id, name, brand, serving_label, calories_kcal, protein_g, carbs_g, fat_g, is_halal, barcode").order("name").limit(200),
    supabase.from("workouts").select("title, scheduled_date, duration_min, sport").eq("user_id", user.id).eq("scheduled_date", today).eq("status", "planned").is("deleted_at", null),
  ]);

  const eaten = {
    calories: (entries ?? []).reduce((sum, row) => sum + Number(row.calories_kcal ?? 0), 0),
    protein: (entries ?? []).reduce((sum, row) => sum + Number(row.protein_g ?? 0), 0),
    carbs: (entries ?? []).reduce((sum, row) => sum + Number(row.carbs_g ?? 0), 0),
    fat: (entries ?? []).reduce((sum, row) => sum + Number(row.fat_g ?? 0), 0),
  };
  const water = (hydration ?? []).reduce((sum, row) => sum + Number(row.amount_ml ?? 0), 0);
  const mode = prefs?.nutrition_mode ?? "flexible";

  return (
    <PageFrame eyebrow="Nutrition" title="Fuel the plan" lede={mode === "flexible" ? "Flexible mode: eat normally, log food, and chase remaining targets. Structured meal plans are optional." : "Structured mode: follow the meal plan, and swap meals when needed. History stays when you switch modes."}>
      <p className="text-sm text-muted">
        Diet preference: {prefs?.dietary_pattern ?? "not set"}
        {(prefs?.allergies?.length ? ` · Allergies: ${prefs.allergies.join(", ")}` : "")}
      </p>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <article className="app-card p-4">
          <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted"><Flame size={16} strokeWidth={1.75} /> Calories</p>
          <p className="metric mt-1 text-3xl font-bold">{Math.round(eaten.calories)}{target ? <span className="text-base text-muted">/{target.calories_kcal}</span> : null}</p>
        </article>
        <article className="app-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Protein</p>
          <p className="metric mt-1 text-3xl font-bold">{Math.round(eaten.protein)}{target ? <span className="text-base text-muted">/{Math.round(Number(target.protein_g))}g</span> : null}</p>
        </article>
        <article className="app-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Carbs</p>
          <p className="metric mt-1 text-3xl font-bold">{Math.round(eaten.carbs)}{target ? <span className="text-base text-muted">/{Math.round(Number(target.carbs_g))}g</span> : null}</p>
        </article>
        <article className="app-card p-4">
          <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted"><Droplets size={16} strokeWidth={1.75} /> Hydration</p>
          <p className="metric mt-1 text-3xl font-bold">{water}{target?.hydration_ml ? <span className="text-base text-muted">/{target.hydration_ml}ml</span> : <span className="text-base text-muted"> ml</span>}</p>
        </article>
      </section>

      {target ? (
        <section className="app-card p-4 text-sm">
          <h2 className="font-bold">How today's target was built</h2>
          <p className="mt-1 text-muted">{target.explanation}</p>
          <p className="mt-2">BMR {target.bmr_kcal} · TDEE {target.tdee_kcal} · Exercise {target.exercise_kcal} · Goal adj {target.goal_adjustment_kcal}</p>
          <p className="text-xs text-muted">Remaining: {Math.max(0, target.calories_kcal - Math.round(eaten.calories))} kcal · Fat logged {Math.round(eaten.fat)}/{Math.round(Number(target.fat_g))}g</p>
        </section>
      ) : (
        <p className="text-sm text-muted">No target yet. Use recalculate after height, weight, and date of birth are saved.</p>
      )}

      {(workouts ?? []).length ? (
        <section className="app-card p-4">
          <h2 className="flex items-center gap-2 font-bold"><Utensils size={18} strokeWidth={1.75} /> Training fueling</h2>
          <ul className="mt-2 grid gap-1 text-sm">
            {(workouts ?? []).map((workout) => (
              <li key={`${workout.title}-${workout.sport}`}>Today: {workout.title} ({workout.duration_min} min {workout.sport}). Prefer familiar carbs before long or hard work; practice race fueling on key endurance days.</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="app-card grid gap-3 p-4">
        <h2 className="font-bold">Log food</h2>
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

      <section className="grid gap-2">
        <h2 className="font-bold">Today's meals</h2>
        <ul className="grid gap-2">
          {(entries ?? []).map((entry) => (
            <li key={entry.id} className="app-card px-4 py-3 text-sm">
              <span className="font-semibold">{entry.food_name}</span>
              <span className="block text-xs text-muted">{entry.meal_slot} · {entry.entry_method} · {Math.round(Number(entry.calories_kcal))} kcal · P{Math.round(Number(entry.protein_g))} C{Math.round(Number(entry.carbs_g))} F{Math.round(Number(entry.fat_g))}{entry.confirmed ? "" : " · unconfirmed"}</span>
            </li>
          ))}
          {(entries ?? []).length === 0 ? <li className="text-sm text-muted">No foods logged yet.</li> : null}
        </ul>
      </section>
    </PageFrame>
  );
}
