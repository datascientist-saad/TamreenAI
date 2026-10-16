import { z } from "zod";

export const sportList = ["strength", "bodybuilding", "running", "cycling", "swimming", "triathlon"] as const;

export const sports = [
  ["strength", "Strength"],
  ["bodybuilding", "Bodybuilding"],
  ["running", "Running"],
  ["cycling", "Cycling"],
  ["swimming", "Swimming"],
  ["triathlon", "Triathlon"],
] as const;

export const goals = [
  ["build_muscle", "Build muscle"],
  ["lose_fat", "Lose fat"],
  ["recomposition", "Recomposition"],
  ["increase_strength", "Increase strength"],
  ["improve_5k", "Improve 5K"],
  ["improve_10k", "Improve 10K"],
  ["half_marathon", "Half marathon"],
  ["marathon", "Marathon"],
  ["sprint_triathlon", "Sprint triathlon"],
  ["olympic_triathlon", "Olympic triathlon"],
  ["ironman_70_3", "Ironman 70.3"],
  ["ironman", "Ironman"],
  ["improve_cycling", "Improve cycling"],
  ["improve_swimming", "Improve swimming"],
  ["general_hybrid", "General hybrid fitness"],
  ["custom", "Custom"],
] as const;

const mark = z.number().positive().nullable().optional();
const benchmarkSchema = z.object({
  fiveKSeconds: mark,
  tenKSeconds: mark,
  halfSeconds: mark,
  marathonSeconds: mark,
  weeklyRunKm: mark,
  ftpWatts: mark,
  weeklyBikeKm: mark,
  swim100Seconds: mark,
  swim400Seconds: mark,
  weeklySwimM: mark,
  squatKg: mark,
  benchKg: mark,
  deadliftKg: mark,
});

export const onboardingSchema = z.object({
  fullName: z.string().trim().min(1).max(80),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  sex: z.enum(["female", "male", "other", "prefer_not_to_say"]).optional(),
  heightCm: z.number().min(50).max(260).nullable().optional(),
  weightKg: z.number().min(20).max(400).nullable().optional(),
  bodyFat: z.number().min(2).max(70).nullable().optional(),
  experience: z.enum(["beginner", "intermediate", "advanced", "elite"]),
  sports: z.array(z.enum(sportList)).min(1),
  primaryGoal: z.string().min(1),
  goals: z.array(z.string()).min(1),
  customGoal: z.string().max(160).optional(),
  preferredDays: z.array(z.number().int().min(0).max(6)).min(1),
  minutesPerDay: z.number().int().min(15).max(360),
  gymAccess: z.boolean(),
  poolAccess: z.boolean(),
  bikeAccess: z.boolean(),
  injuries: z.array(z.object({
    status: z.enum(["current", "previous"]),
    bodyArea: z.string().min(1).max(80),
    description: z.string().max(400),
    avoid: z.array(z.string()).max(12),
    severity: z.enum(["mild", "moderate", "severe"]),
    redFlag: z.boolean(),
  })).max(12).optional(),
  event: z.object({
    name: z.string().min(1).max(120),
    eventType: z.string().min(1).max(80),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    distanceM: z.number().positive().nullable(),
    goalTimeSeconds: z.number().int().positive().nullable(),
  }).nullable(),
  benchmarks: benchmarkSchema.optional(),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
