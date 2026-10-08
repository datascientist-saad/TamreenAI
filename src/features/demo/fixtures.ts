/**
 * Public demo fixtures. These objects never leave the browser preview.
 * Do not pass them to server actions or Supabase writes.
 */

export const sampleAdjustment =
  "Your hard run moved to Thursday to allow more recovery after Wednesday’s lower-body strength session.";

export type DemoSport = "strength" | "running" | "cycling" | "swimming";

export interface DemoSession {
  id: string;
  date: string;
  weekday: string;
  sport: DemoSport;
  title: string;
  minutes: number;
  kind: "strength" | "endurance" | "rest";
}

export const originalWeek: DemoSession[] = [
  { id: "mon-upper", date: "5 Oct 2026", weekday: "Mon", sport: "strength", title: "Upper-body strength", minutes: 50, kind: "strength" },
  { id: "tue-easy", date: "6 Oct 2026", weekday: "Tue", sport: "running", title: "Easy run", minutes: 40, kind: "endurance" },
  { id: "wed-legs", date: "7 Oct 2026", weekday: "Wed", sport: "strength", title: "Lower-body strength", minutes: 60, kind: "strength" },
  { id: "wed-hard", date: "7 Oct 2026", weekday: "Wed", sport: "running", title: "Hard run", minutes: 45, kind: "endurance" },
  { id: "thu-rest", date: "8 Oct 2026", weekday: "Thu", sport: "cycling", title: "Rest", minutes: 0, kind: "rest" },
  { id: "fri-swim", date: "9 Oct 2026", weekday: "Fri", sport: "swimming", title: "Swim technique", minutes: 40, kind: "endurance" },
  { id: "sat-long", date: "10 Oct 2026", weekday: "Sat", sport: "running", title: "Long run", minutes: 80, kind: "endurance" },
  { id: "sun-spin", date: "11 Oct 2026", weekday: "Sun", sport: "cycling", title: "Easy spin", minutes: 45, kind: "endurance" },
];

export const adjustedWeek: DemoSession[] = [
  { id: "mon-upper", date: "5 Oct 2026", weekday: "Mon", sport: "strength", title: "Upper-body strength", minutes: 50, kind: "strength" },
  { id: "tue-easy", date: "6 Oct 2026", weekday: "Tue", sport: "running", title: "Easy run", minutes: 40, kind: "endurance" },
  { id: "wed-legs", date: "7 Oct 2026", weekday: "Wed", sport: "strength", title: "Lower-body strength", minutes: 60, kind: "strength" },
  { id: "thu-hard", date: "8 Oct 2026", weekday: "Thu", sport: "running", title: "Hard run", minutes: 45, kind: "endurance" },
  { id: "fri-swim", date: "9 Oct 2026", weekday: "Fri", sport: "swimming", title: "Swim technique", minutes: 40, kind: "endurance" },
  { id: "sat-long", date: "10 Oct 2026", weekday: "Sat", sport: "running", title: "Long run", minutes: 80, kind: "endurance" },
  { id: "sun-spin", date: "11 Oct 2026", weekday: "Sun", sport: "cycling", title: "Easy spin", minutes: 45, kind: "endurance" },
];

export const strengthWorkout = {
  title: "Lower-body strength",
  date: "Wednesday 7 Oct 2026",
  purpose: "Build lower-body strength on a day that is kept apart from the hard run.",
  sets: [
    { exercise: "Back squat", sets: "4", reps: "5", weight: "100 kg", camera: "Camera rule: squat" },
    { exercise: "Romanian deadlift", sets: "3", reps: "8", weight: "70 kg", camera: "Camera rule: Romanian deadlift" },
    { exercise: "Calf raise", sets: "3", reps: "12", weight: "40 kg", camera: "Logged only. No camera score." },
  ],
};

export const enduranceWorkout = {
  title: "Hard run",
  date: "Moves with the sample adjustment",
  distance: "8.0 km",
  duration: "42 min",
  effort: "7 / 10",
  heartRate: "Not in this sample",
  purpose: "A quality run. In this example it is placed the day after lower-body strength so the two are not stacked.",
};

export const progressRows = [
  {
    dimension: "Strength",
    score: "74",
    definition: "Strength uses squat, bench, and deadlift as multiples of body weight. A missing lift is left out.",
    note: "Sample figures only. They are not a measured result.",
  },
  {
    dimension: "Running",
    score: "81",
    definition: "Running compares a logged or reported pace with the target pace for the primary goal.",
    note: "Sample figures only. They are not a measured result.",
  },
  {
    dimension: "Cycling",
    score: "—",
    definition: "Cycling uses FTP and body weight when both exist. Watts alone are used if weight is missing.",
    note: "Missing data. This sample has no FTP, so the score stays blank.",
  },
  {
    dimension: "Swimming",
    score: "—",
    definition: "Swimming uses 100 m pace. 90 seconds scores the top of this scale.",
    note: "Missing data. This sample has no pace, so the score stays blank.",
  },
  {
    dimension: "Consistency",
    score: "86",
    definition: "Consistency is completed sessions divided by planned sessions in the recent window.",
    note: "Sample figures only. They are not a measured result.",
  },
  {
    dimension: "Overall",
    score: "79",
    definition: "The performance score averages only the dimensions that have inputs, with extra weight on the primary goal.",
    note: "This sample uses strength, running, and consistency. Cycling and swimming are left out.",
  },
];
