"use client";

import { useMemo, useState } from "react";
import { logFoodEntry, logHydration, upsertNutritionTargets } from "@/server/mvp-actions";

type CatalogFood = {
  id: string;
  name: string;
  brand: string | null;
  serving_label: string | null;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  is_halal: boolean | null;
  barcode: string | null;
};

export function NutritionLogger({ foods }: { foods: CatalogFood[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CatalogFood | null>(null);
  const [method, setMethod] = useState<"search" | "manual" | "barcode" | "natural_language" | "photo" | "saved_meal">("search");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return foods.slice(0, 8);
    return foods.filter((food) => {
      const hay = `${food.name} ${food.brand ?? ""} ${food.barcode ?? ""}`.toLowerCase();
      return hay.includes(q);
    }).slice(0, 12);
  }, [foods, query]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {([
          ["search", "Search"],
          ["manual", "Manual"],
          ["barcode", "Barcode"],
          ["natural_language", "Text"],
          ["photo", "Photo"],
          ["saved_meal", "Saved"],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" className={`btn ${method === id ? "btn-primary" : "btn-ghost"}`} onClick={() => setMethod(id)}>
            {label}
          </button>
        ))}
      </div>

      {method === "photo" ? (
        <p className="text-sm text-muted">Photo recognition needs an AI key and athlete confirmation. If analysis fails, use search or manual entry. Do not invent nutrition values from the model alone.</p>
      ) : null}
      {method === "natural_language" ? (
        <p className="text-sm text-muted">Describe a meal, then match items from the catalog or enter macros manually after confirming portions.</p>
      ) : null}

      <form
        className="grid gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setPending(true);
          setError("");
          setMessage("");
          const qty = Number(form.get("quantity") || 1);
          const food = selected;
          const calories = food ? Number(food.calories_kcal) * qty : Number(form.get("calories") || 0);
          const protein = food ? Number(food.protein_g) * qty : Number(form.get("protein") || 0);
          const carbs = food ? Number(food.carbs_g) * qty : Number(form.get("carbs") || 0);
          const fat = food ? Number(food.fat_g) * qty : Number(form.get("fat") || 0);
          const name = food?.name || String(form.get("foodName") || "").trim();
          if (!name) {
            setPending(false);
            setError("Enter or select a food.");
            return;
          }
          const result = await logFoodEntry({
            foodName: name,
            foodId: food?.id ?? null,
            mealSlot: String(form.get("mealSlot") || "other") as "breakfast" | "lunch" | "dinner" | "snack" | "pre_workout" | "during_workout" | "post_workout" | "other",
            entryMethod: method,
            quantity: qty,
            unit: String(form.get("unit") || food?.serving_label || "serving"),
            caloriesKcal: calories,
            proteinG: protein,
            carbsG: carbs,
            fatG: fat,
            rawInput: String(form.get("rawInput") || query || ""),
            notes: String(form.get("notes") || ""),
            confirmed: true,
          });
          setPending(false);
          if (!result.ok) {
            setError(result.message);
            return;
          }
          setMessage("Food logged.");
          setSelected(null);
          setQuery("");
          event.currentTarget.reset();
        }}
      >
        {(method === "search" || method === "barcode" || method === "saved_meal") ? (
          <>
            <label>{method === "barcode" ? "Barcode or name" : "Search foods"}
              <input value={query} onChange={(event) => { setQuery(event.target.value); setSelected(null); }} placeholder={method === "barcode" ? "Scan/type barcode" : "Chicken, rice, dates…"} />
            </label>
            <ul className="grid gap-2">
              {matches.map((food) => (
                <li key={food.id}>
                  <button
                    type="button"
                    className={`w-full rounded-2xl border px-3 py-2 text-left text-sm ${selected?.id === food.id ? "border-maroon bg-maroon/10" : "border-line"}`}
                    onClick={() => { setSelected(food); setQuery(food.name); }}
                  >
                    <span className="font-semibold">{food.name}</span>
                    <span className="block text-xs text-muted">
                      {Math.round(Number(food.calories_kcal))} kcal · P {food.protein_g} C {food.carbs_g} F {food.fat_g}
                      {food.is_halal ? " · Halal" : ""}
                      {food.barcode ? ` · ${food.barcode}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {(method === "manual" || method === "natural_language" || method === "photo" || !selected) ? (
          <>
            {method === "natural_language" || method === "photo" ? (
              <label>Description<textarea name="rawInput" placeholder="e.g. grilled chicken, rice, salad with olive oil" /></label>
            ) : null}
            {!selected ? <label>Food name<input name="foodName" /></label> : null}
            {!selected ? (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <label>Calories<input name="calories" inputMode="decimal" defaultValue={0} /></label>
                <label>Protein g<input name="protein" inputMode="decimal" defaultValue={0} /></label>
                <label>Carbs g<input name="carbs" inputMode="decimal" defaultValue={0} /></label>
                <label>Fat g<input name="fat" inputMode="decimal" defaultValue={0} /></label>
              </div>
            ) : null}
          </>
        ) : null}

        <label>Servings<input name="quantity" inputMode="decimal" defaultValue={1} /></label>
        <label>Unit<input name="unit" defaultValue={selected?.serving_label || "serving"} /></label>
        <label>Meal slot
          <select name="mealSlot" defaultValue="lunch">
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
            <option value="pre_workout">Pre-workout</option>
            <option value="during_workout">During workout</option>
            <option value="post_workout">Post-workout</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>Notes<textarea name="notes" /></label>
        {error ? <p className="text-sm text-live">{error}</p> : null}
        {message ? <p className="text-sm">{message}</p> : null}
        <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Saving…" : "Log food"}</button>
      </form>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const result = await logHydration(Number(form.get("ml") || 0));
          setMessage(result.ok ? "Hydration logged." : result.message);
        }}
      >
        <label className="grow">Hydration (ml)<input name="ml" inputMode="numeric" defaultValue={250} /></label>
        <button className="btn btn-ghost" type="submit">Add water</button>
      </form>

      <button
        type="button"
        className="btn btn-ghost w-fit"
        onClick={async () => {
          const result = await upsertNutritionTargets("training");
          setMessage(result.ok ? "Targets recalculated from profile and today's sessions." : result.message);
        }}
      >
        Recalculate today's targets
      </button>
    </div>
  );
}
