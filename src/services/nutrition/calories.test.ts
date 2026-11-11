import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ageFromDob, computeDailyTargets, estimateBmr, exerciseKcalFromLoad, mapGoalSlug } from "./calories";

describe("nutrition calories", () => {
  it("estimates Mifflin–St Jeor BMR for the example athlete", () => {
    // 25y, 75kg, 166cm, sex unknown → female equation
    const bmr = estimateBmr(75, 166, 25, "prefer_not_to_say");
    assert.equal(bmr, Math.round(10 * 75 + 6.25 * 166 - 5 * 25 - 161));
  });

  it("does not double-count exercise energy", () => {
    const withExercise = computeDailyTargets({
      weightKg: 75,
      heightCm: 166,
      ageYears: 25,
      sex: "prefer_not_to_say",
      plannedExerciseKcal: 400,
      dayType: "training",
      primaryGoal: "endurance",
    });
    const skipped = computeDailyTargets({
      weightKg: 75,
      heightCm: 166,
      ageYears: 25,
      sex: "prefer_not_to_say",
      plannedExerciseKcal: 400,
      dayType: "training",
      primaryGoal: "endurance",
      exerciseAlreadyCounted: true,
    });
    assert.ok(withExercise.caloriesKcal > skipped.caloriesKcal);
    assert.equal(skipped.exerciseKcal, 0);
  });

  it("raises inadequate energy targets to the floor", () => {
    const targets = computeDailyTargets({
      weightKg: 75,
      heightCm: 166,
      ageYears: 25,
      sex: "female",
      dayType: "rest",
      primaryGoal: "lose_fat",
      plannedExerciseKcal: 0,
    });
    assert.ok(targets.caloriesKcal >= Math.round(75 * 30));
  });

  it("prefers completed exercise kcal over planned", () => {
    const targets = computeDailyTargets({
      weightKg: 70,
      heightCm: 170,
      ageYears: 30,
      sex: "male",
      plannedExerciseKcal: 200,
      completedExerciseKcal: 500,
      dayType: "training",
      primaryGoal: "maintain",
    });
    assert.equal(targets.exerciseKcal, 500);
  });

  it("maps endurance-related goal slugs", () => {
    assert.equal(mapGoalSlug("endurance"), "endurance");
    assert.equal(mapGoalSlug("t100"), "endurance");
    assert.equal(mapGoalSlug("lose_fat"), "lose_fat");
  });

  it("derives age from date of birth", () => {
    assert.equal(ageFromDob("2000-11-11", "2025-11-11"), 25);
    assert.equal(ageFromDob("2000-11-12", "2025-11-11"), 24);
  });

  it("converts training load to a conservative kcal estimate", () => {
    assert.equal(exerciseKcalFromLoad(100, 70), 60);
    assert.equal(exerciseKcalFromLoad(null, 70), 0);
  });
});
