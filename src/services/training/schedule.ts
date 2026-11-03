export type ScheduleMove = {
  id: string;
  title: string;
  fromDate: string;
  toDate: string;
  reason: string;
};

export function matchScheduleChanges(
  rows: Array<{ id: string; title: string; scheduled_date: string }>,
  changes: Array<{ title: string; fromDate: string; toDate: string; reason: string }>,
): ScheduleMove[] {
  const used = new Set<string>();
  const applied: ScheduleMove[] = [];
  for (const change of changes) {
    if (!change.toDate || change.fromDate === change.toDate) continue;
    const row = rows.find((item) => !used.has(item.id) && item.title === change.title && item.scheduled_date === change.fromDate);
    if (!row) continue;
    used.add(row.id);
    applied.push({
      id: row.id,
      title: row.title,
      fromDate: change.fromDate,
      toDate: change.toDate,
      reason: change.reason,
    });
  }
  return applied;
}

export function optimizeExplanation(input: {
  beforeCount: number;
  afterCount: number;
  changeCount: number;
  engineExplanation: string;
}): string {
  if (input.changeCount > 0 && input.beforeCount > 0 && input.afterCount === 0) {
    const sessions = input.changeCount === 1 ? "1 session moved" : `${input.changeCount} sessions moved`;
    return `${sessions}. The stacked sessions are no longer on top of each other.`;
  }
  if (input.changeCount > 0 && input.afterCount === 0) {
    const sessions = input.changeCount === 1 ? "1 session moved" : `${input.changeCount} sessions moved`;
    return `${sessions} onto the days you can train, with hard efforts kept apart.`;
  }
  if (input.changeCount > 0 && input.afterCount > 0) {
    const left = input.afterCount === 1 ? "1 conflict still needs" : `${input.afterCount} conflicts still need`;
    return `${input.changeCount} sessions moved inside your available days. ${left} another open day. Drag a workout if you want them further apart.`;
  }
  if (input.beforeCount > 0) {
    return "These sessions could not be separated on the days you marked available. Drag a workout to another day, or add a training day on your profile.";
  }
  return input.engineExplanation || "This week already keeps hard sessions apart.";
}
