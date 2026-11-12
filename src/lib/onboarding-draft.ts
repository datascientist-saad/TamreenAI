export type OnboardingDraft = {
  completed: boolean;
  fullName: string;
  dateOfBirth: string;
  sex: "female" | "male" | "other" | "prefer_not_to_say";
  heightCm: string;
  weightKg: string;
  bodyFat: string;
  experience: "beginner" | "intermediate" | "advanced" | "elite";
  sports: string[];
  primaryGoal: string;
  goals: string[];
  customGoal: string;
  preferredDays: number[];
  minutesPerDay: string;
  multipleSessionsPerDay: boolean | null;
  gymAccess: boolean;
  poolAccess: boolean;
  bikeAccess: boolean;
  injuryArea: string;
  injuryNote: string;
  avoid: string;
  severity: "mild" | "moderate" | "severe";
  redFlag: boolean;
  training: boolean;
  eventId: string | null;
  eventName: string;
  eventType: string;
  eventDate: string;
  distanceM: string;
  goalTimeSeconds: number | null;
  benchmarks: {
    fiveKSeconds: number | null;
    tenKSeconds: number | null;
    halfSeconds: number | null;
    marathonSeconds: number | null;
    weeklyRunKm: number | null;
    ftpWatts: number | null;
    weeklyBikeKm: number | null;
    swim100Seconds: number | null;
    swim400Seconds: number | null;
    weeklySwimM: number | null;
    squatKg: number | null;
    benchKg: number | null;
    deadliftKg: number | null;
  };
  preferences: {
    dietaryPattern: "none" | "halal" | "vegetarian" | "vegan" | "pescatarian" | "kosher" | "custom";
    allergies: string;
    nutritionMode: "flexible" | "structured";
    schedulingMode: "adaptive" | "fixed";
    sportPriorityMode: "ai_recommended" | "athlete_controlled";
    assessmentPath: "self_report" | "benchmark" | "hybrid";
    healthDataConsent: boolean;
  };
};

export function blankOnboardingDraft(): OnboardingDraft {
  return {
    completed: false,
    fullName: "",
    dateOfBirth: "",
    sex: "prefer_not_to_say",
    heightCm: "",
    weightKg: "",
    bodyFat: "",
    experience: "intermediate",
    sports: [],
    primaryGoal: "",
    goals: [],
    customGoal: "",
    preferredDays: [1, 2, 3, 4, 5, 6],
    minutesPerDay: "60",
    multipleSessionsPerDay: null,
    gymAccess: true,
    poolAccess: false,
    bikeAccess: false,
    injuryArea: "",
    injuryNote: "",
    avoid: "",
    severity: "mild",
    redFlag: false,
    training: false,
    eventId: null,
    eventName: "",
    eventType: "race",
    eventDate: "",
    distanceM: "",
    goalTimeSeconds: null,
    benchmarks: {
      fiveKSeconds: null,
      tenKSeconds: null,
      halfSeconds: null,
      marathonSeconds: null,
      weeklyRunKm: null,
      ftpWatts: null,
      weeklyBikeKm: null,
      swim100Seconds: null,
      swim400Seconds: null,
      weeklySwimM: null,
      squatKg: null,
      benchKg: null,
      deadliftKg: null,
    },
    preferences: {
      dietaryPattern: "none",
      allergies: "",
      nutritionMode: "flexible",
      schedulingMode: "adaptive",
      sportPriorityMode: "ai_recommended",
      assessmentPath: "hybrid",
      healthDataConsent: false,
    },
  };
}
