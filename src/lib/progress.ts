import { daysUntil } from "@/lib/utils";

export interface ProgressWorkout {
  id?: string | null;
  status: string;
  scheduled_date: string;
}

export interface ProgressLog {
  workout_id: string | null;
  started_on: string;
}

export function trainingWindow(input: {
  today: string;
  start: string;
  end: string;
  doneFrom?: string;
  workouts: ProgressWorkout[];
  logs?: ProgressLog[];
}): { daysLeft: number; done: number; remaining: number } {
  const daysLeft = Math.max(0, daysUntil(input.end, input.today));
  const doneFrom = input.doneFrom ?? input.start;
  const linked = new Set<string>();
  let done = 0;
  let remaining = 0;
  for (const log of input.logs ?? []) {
    if (log.started_on < doneFrom || log.started_on > input.end || log.started_on > input.today) continue;
    done += 1;
    if (log.workout_id) linked.add(log.workout_id);
  }
  for (const workout of input.workouts) {
    if (workout.scheduled_date < input.start || workout.scheduled_date > input.end) continue;
    if (workout.status === "completed" && !(workout.id && linked.has(workout.id))) done += 1;
    else if (workout.status === "planned" && workout.scheduled_date >= input.today) remaining += 1;
  }
  return { daysLeft, done, remaining };
}
