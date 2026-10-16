export interface ClockParts {
  hours: string;
  minutes: string;
  seconds: string;
}

export function emptyClock(): ClockParts {
  return { hours: "", minutes: "", seconds: "" };
}

export function clockToSeconds(
  parts: ClockParts,
  withHours: boolean,
): { seconds: number | null } | { error: string } {
  const fields: Array<[keyof ClockParts, boolean]> = [
    ["hours", withHours],
    ["minutes", true],
    ["seconds", true],
  ];
  const numbers = { hours: 0, minutes: 0, seconds: 0 };
  let any = false;
  for (const [key, used] of fields) {
    if (!used) continue;
    const trimmed = parts[key].trim();
    if (trimmed === "") continue;
    if (!/^\d+$/.test(trimmed)) return { error: "Use whole numbers for the time." };
    any = true;
    numbers[key] = Number(trimmed);
  }
  if (!any) return { seconds: null };
  if (numbers.seconds > 59) return { error: "Seconds stay under 60." };
  if (withHours && numbers.minutes > 59) return { error: "Minutes stay under 60 when hours are shown." };
  const total = numbers.hours * 3600 + numbers.minutes * 60 + numbers.seconds;
  return { seconds: total > 0 ? total : null };
}
