import { daysUntil } from "@/lib/utils";

export interface ProgressWorkout {
  status: string;
  scheduled_date: string;
}

export function trainingWindow(input: {
  today: string;
  start: string;
  end: string;
  workouts: ProgressWorkout[];
}): { daysLeft: number; done: number; remaining: number } {
  const daysLeft = Math.max(0, daysUntil(input.end, input.today));
  let done = 0;
  let remaining = 0;
  for (const workout of input.workouts) {
    if (workout.scheduled_date < input.start || workout.scheduled_date > input.end) continue;
    if (workout.status === "completed") done += 1;
    else if (workout.status === "planned" && workout.scheduled_date >= input.today) remaining += 1;
  }
  return { daysLeft, done, remaining };
}
