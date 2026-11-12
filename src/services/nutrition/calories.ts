/**
 * Deterministic energy and macronutrient calculations.
 * AI must not invent these numbers.
 */

export type Sex = "female" | "male" | "other" | "prefer_not_to_say" | null;

export type DayType = "training" | "recovery" | "race" | "rest";

export type NutritionGoal =
  | "lose_fat"
  | "build_muscle"
  | "recomposition"
  | "endurance"
  | "maintain"
  | "other";

export interface CalorieInput {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  sex: Sex;
  /** Planned session load for the day; used once for exercise energy. */
  plannedExerciseKcal?: number | null;
  /** Completed session load energy; preferred over planned when present. */
  completedExerciseKcal?: number | null;
  dayType: DayType;
  primaryGoal: NutritionGoal;
  /** When true, do not add exercise kcal again if already embedded in TDEE. */
  exerciseAlreadyCounted?: boolean;
}

export interface MacroTargets {
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  hydrationMl: number | null;
  bmrKcal: number;
  tdeeKcal: number;
  exerciseKcal: number;
  goalAdjustmentKcal: number;
  method: "mifflin_st_jeor";
  explanation: string;
  factors: Array<{ label: string; detail: string }>;
  limitations: string[];
  inadequateEnergyRisk: boolean;
}

/** Mifflin–St Jeor BMR. Sex other/unknown uses the female equation as a conservative default. */
export function estimateBmr(weightKg: number, heightCm: number, ageYears: number, sex: Sex): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  if (sex === "male") return Math.round(base + 5);
  return Math.round(base - 161);
}

export function activityMultiplier(dayType: DayType): number {
  switch (dayType) {
    case "race":
      return 1.725;
    case "training":
      return 1.55;
    case "recovery":
      return 1.4;
    case "rest":
    default:
      return 1.2;
  }
}

export function goalAdjustmentKcal(goal: NutritionGoal, dayType: DayType): number {
  if (goal === "lose_fat") return dayType === "race" ? -100 : -300;
  if (goal === "build_muscle") return 200;
  if (goal === "recomposition") return -100;
  if (goal === "endurance") return dayType === "training" || dayType === "race" ? 150 : 0;
  return 0;
}

/** Rough kcal from session load units used by the training engine (load ≈ RPE×duration proxy). */
export function exerciseKcalFromLoad(load: number | null | undefined, weightKg: number): number {
  if (load == null || !Number.isFinite(load) || load <= 0) return 0;
  // Conservative: ~0.6 kcal per load unit scaled lightly by body mass.
  return Math.round(load * 0.6 * (weightKg / 70));
}

export function computeDailyTargets(input: CalorieInput): MacroTargets {
  const factors: Array<{ label: string; detail: string }> = [];
  const limitations: string[] = [];
  const bmr = estimateBmr(input.weightKg, input.heightCm, input.ageYears, input.sex);
  factors.push({ label: "BMR", detail: `Mifflin–St Jeor estimate ${bmr} kcal.` });

  const multiplier = activityMultiplier(input.dayType);
  const tdee = Math.round(bmr * multiplier);
  factors.push({ label: "Day type", detail: `${input.dayType} multiplier ${multiplier} → TDEE ${tdee} kcal.` });

  const completed = input.completedExerciseKcal;
  const planned = input.plannedExerciseKcal;
  let exercise = 0;
  if (completed != null && Number.isFinite(completed) && completed > 0) {
    exercise = Math.round(completed);
    factors.push({ label: "Exercise energy", detail: `Using completed session estimate ${exercise} kcal.` });
  } else if (planned != null && Number.isFinite(planned) && planned > 0) {
    exercise = Math.round(planned);
    factors.push({ label: "Exercise energy", detail: `Using planned session estimate ${exercise} kcal (provisional).` });
  } else {
    limitations.push("No session energy was provided; only lifestyle TDEE is used.");
  }

  if (input.exerciseAlreadyCounted) {
    exercise = 0;
    factors.push({ label: "Exercise energy", detail: "Skipped to avoid double-counting." });
  }

  // Lifestyle TDEE already includes light activity. Add only the training increment above sedentary baseline.
  const sedentary = Math.round(bmr * 1.2);
  const lifestyleExtra = Math.max(0, tdee - sedentary);
  const trainingExtra = exercise;
  const goalAdj = goalAdjustmentKcal(input.primaryGoal, input.dayType);
  factors.push({ label: "Goal adjustment", detail: `${goalAdj} kcal for ${input.primaryGoal}.` });

  let calories = sedentary + lifestyleExtra + trainingExtra + goalAdj;
  // Absolute floor: never prescribe below ~30 kcal/kg for endurance athletes without review.
  const floor = Math.round(Math.max(800, input.weightKg * 30));
  let inadequateEnergyRisk = false;
  if (calories < floor) {
    inadequateEnergyRisk = true;
    limitations.push(`Target ${calories} kcal was below the ${floor} kcal safeguard (~30 kcal/kg). Raised to the floor for review.`);
    calories = floor;
  }
  calories = Math.min(10000, Math.max(800, Math.round(calories)));

  const proteinG = Math.round(input.weightKg * (input.primaryGoal === "build_muscle" || input.primaryGoal === "recomposition" ? 1.8 : 1.6));
  const fatG = Math.round(Math.max(input.weightKg * 0.8, (calories * 0.25) / 9));
  const proteinKcal = proteinG * 4;
  const fatKcal = fatG * 9;
  const carbsG = Math.max(0, Math.round((calories - proteinKcal - fatKcal) / 4));
  const hydrationMl = input.dayType === "race" || input.dayType === "training" ? Math.round(input.weightKg * 35) : Math.round(input.weightKg * 30);

  return {
    caloriesKcal: calories,
    proteinG,
    carbsG,
    fatG,
    hydrationMl,
    bmrKcal: bmr,
    tdeeKcal: tdee,
    exerciseKcal: trainingExtra,
    goalAdjustmentKcal: goalAdj,
    method: "mifflin_st_jeor",
    explanation: `Deterministic targets from BMR, day type, training energy, and goal. Not a medical prescription.`,
    factors,
    limitations,
    inadequateEnergyRisk,
  };
}

export function mapGoalSlug(slug: string): NutritionGoal {
  if (slug === "lose_fat") return "lose_fat";
  if (slug === "build_muscle" || slug === "increase_strength") return "build_muscle";
  if (slug === "recomposition") return "recomposition";
  if (
    slug === "endurance"
    || slug.includes("marathon")
    || slug.includes("triathlon")
    || slug === "t100"
    || slug === "improve_cycling"
    || slug === "improve_swimming"
    || slug === "improve_5k"
    || slug === "improve_10k"
    || slug === "general_hybrid"
  ) return "endurance";
  return "other";
}

export function ageFromDob(dob: string, onDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || !/^\d{4}-\d{2}-\d{2}$/.test(onDate)) return null;
  const [y, m, d] = dob.split("-").map(Number);
  const [Y, M, D] = onDate.split("-").map(Number);
  let age = Y - y;
  if (M < m || (M === m && D < d)) age -= 1;
  return age >= 10 && age <= 100 ? age : null;
}
