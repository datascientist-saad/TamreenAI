import assert from "node:assert/strict";
import test from "node:test";
import { onboardingSchema } from "./schema";

const short = {
  fullName: "Nora",
  experience: "beginner" as const,
  sports: ["running", "strength"] as const,
  primaryGoal: "improve_10k",
  goals: ["improve_10k"],
  preferredDays: [1, 3, 5],
  minutesPerDay: 45,
  gymAccess: true,
  poolAccess: false,
  bikeAccess: false,
  event: null,
};

test("three-screen onboarding does not require body measurements", () => {
  const parsed = onboardingSchema.parse(short);
  assert.equal(parsed.heightCm, undefined);
  assert.equal(parsed.weightKg, undefined);
  assert.equal(parsed.benchmarks, undefined);
  assert.equal(parsed.injuries, undefined);
  assert.equal(parsed.event, null);
});

test("an event needs a name and a date together", () => {
  const parsed = onboardingSchema.parse({
    ...short,
    event: {
      name: "Doha 10K",
      eventType: "improve_10k",
      date: "2026-12-01",
      distanceM: null,
      goalTimeSeconds: null,
    },
  });
  assert.equal(parsed.event?.name, "Doha 10K");
});

test("sports cannot be empty", () => {
  assert.equal(onboardingSchema.safeParse({ ...short, sports: [] }).success, false);
});
