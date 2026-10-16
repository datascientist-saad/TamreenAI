export const sportSlugs = [
  "strength",
  "bodybuilding",
  "running",
  "cycling",
  "swimming",
  "triathlon",
  "football",
  "padel",
  "basketball",
  "tennis",
  "volleyball",
  "pickleball",
  "badminton",
  "cricket",
] as const;

export type SportSlug = (typeof sportSlugs)[number];

export const sportLabels: Record<SportSlug, string> = {
  strength: "Strength",
  bodybuilding: "Bodybuilding",
  running: "Running",
  cycling: "Cycling",
  swimming: "Swimming",
  triathlon: "Triathlon",
  football: "Football",
  padel: "Padel",
  basketball: "Basketball",
  tennis: "Tennis",
  volleyball: "Volleyball",
  pickleball: "Pickleball",
  badminton: "Badminton",
  cricket: "Cricket",
};

export const sportGroups: Array<{ label: string; slugs: SportSlug[] }> = [
  {
    label: "Gym and endurance",
    slugs: ["strength", "bodybuilding", "running", "cycling", "swimming", "triathlon"],
  },
  {
    label: "Sports people play",
    slugs: ["football", "padel", "basketball", "tennis", "volleyball", "pickleball", "badminton", "cricket"],
  },
];

export const goalOptions = [
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
  ["improve_football", "Play better football"],
  ["improve_padel", "Play better padel"],
  ["improve_basketball", "Play better basketball"],
  ["improve_tennis", "Play better tennis"],
  ["improve_volleyball", "Play better volleyball"],
  ["improve_pickleball", "Play better pickleball"],
  ["improve_badminton", "Play better badminton"],
  ["improve_cricket", "Play better cricket"],
  ["general_hybrid", "General hybrid fitness"],
  ["custom", "Custom"],
] as const;

export const goalGroups = [
  ["Strength", ["build_muscle", "lose_fat", "recomposition", "increase_strength"]],
  ["Running", ["improve_5k", "improve_10k", "half_marathon", "marathon"]],
  ["Triathlon", ["sprint_triathlon", "olympic_triathlon", "ironman_70_3", "ironman"]],
  ["Court and field", ["improve_football", "improve_padel", "improve_basketball", "improve_tennis", "improve_volleyball", "improve_pickleball", "improve_badminton", "improve_cricket"]],
  ["Other", ["improve_cycling", "improve_swimming", "general_hybrid", "custom"]],
] as const;
