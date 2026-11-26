/**
 * Race Prep checklist, timeline, and phase helpers.
 * Deterministic structure; AI may personalize copy within these rules.
 */

import type { EventPriority } from "./catalog";
import type { EventPhaseType } from "./periodization";
import { eventLocalDate, formatStartInZone, type PolicyEvent } from "./policy";
import { individualizeTaper } from "./taper";

export type RacePrepPhase = "prepare" | "fuel" | "race_day" | "recover" | "result";

export type ChecklistItem = {
  id: string;
  label: string;
  section: "prepare" | "fuel" | "race_day" | "recover";
  done: boolean;
  optional?: boolean;
  doneAt?: string | null;
};

export type TimelineItem = {
  id: string;
  label: string;
  at: string | null;
  offsetMin: number | null;
  done: boolean;
  action?: string | null;
  conflict?: string | null;
};

export type FuelSlot = {
  id: "day_before" | "race_morning" | "during" | "after";
  title: string;
  suggestions: string[];
  preferred?: string | null;
  tried: string[];
  carry?: string | null;
  aidStations?: string | null;
  notes?: string | null;
};

/** Kit packing items shown as "N of 5 packed" on Today and under Prepare. */
export const RACE_KIT_IDS = [
  "collect_bib",
  "confirm_transport",
  "pack_kit",
  "pack_fuel",
  "choose_breakfast",
] as const;

export type RaceKitId = (typeof RACE_KIT_IDS)[number];

export type KitProgress = {
  done: number;
  total: number;
  label: string;
  ready: boolean;
  next: ChecklistItem | null;
  items: ChecklistItem[];
};

export type RacePrepSnapshot = {
  eventId: string;
  eventName: string;
  phase: RacePrepPhase;
  section: "prepare" | "fuel" | "race_day" | "recover";
  daysUntil: number;
  countdownLabel: string;
  /** Static screen-reader label — does not tick every minute. */
  countdownAnnounce: string;
  startLabel: string | null;
  /** Short local start like "Sat, 6:00 a.m." */
  startTimeLabel: string | null;
  /** Friendly zone like "Doha time". */
  timeZoneDisplay: string | null;
  timeZoneLabel: string | null;
  needsStartTime: boolean;
  eventDateLabel: string;
  nextTask: ChecklistItem | TimelineItem | null;
  checklist: ChecklistItem[];
  checklistProgress: { done: number; total: number };
  kitProgress: KitProgress;
  timeline: TimelineItem[];
  fuel: FuelSlot[];
  scheduleNotes: string[];
  cardTitle: string;
  cardSubtitle: string;
  imageUrl?: string | null;
};

function addMinutes(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * 60_000).toISOString();
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

const ZONE_CITY: Record<string, string> = {
  "Asia/Qatar": "Doha",
  "Asia/Dubai": "Dubai",
  "Asia/Riyadh": "Riyadh",
  "Asia/Kuwait": "Kuwait",
  "Asia/Bahrain": "Bahrain",
  "Asia/Muscat": "Muscat",
  "Asia/Singapore": "Singapore",
  "Europe/London": "London",
  "Europe/Paris": "Paris",
  "America/New_York": "New York",
  "America/Los_Angeles": "Los Angeles",
  "America/Chicago": "Chicago",
  "Australia/Sydney": "Sydney",
  UTC: "UTC",
};

export function timeZoneDisplayName(timeZone: string | null | undefined): string | null {
  if (!timeZone) return null;
  const city = ZONE_CITY[timeZone] ?? timeZone.split("/").pop()?.replace(/_/g, " ") ?? timeZone;
  return `${city} time`;
}

/**
 * Local start for athlete-facing copy: "Sat, 6:00 a.m."
 * Prefers wave/event starts_at; returns null when missing.
 */
export function formatLocalStartTime(
  startsAt: string | null | undefined,
  timeZone: string | null | undefined,
): string | null {
  if (!startsAt) return null;
  const zone = timeZone || "UTC";
  try {
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "short" }).format(new Date(startsAt));
    const time = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(startsAt));
    // Normalize "AM"/"PM" → "a.m."/"p.m."
    const normalized = time.replace(/\s?AM/i, " a.m.").replace(/\s?PM/i, " p.m.").replace(/\s+/g, " ").trim();
    return `${weekday}, ${normalized}`;
  } catch {
    return null;
  }
}

export function formatEventDateLabel(eventDate: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${eventDate}T12:00:00Z`));
  } catch {
    return eventDate;
  }
}

/**
 * Countdown from wave/event start. Days when >24h away; hours/minutes inside 24h.
 * No seconds. Callers should avoid live aria-live ticks every minute.
 */
export function formatRaceCountdown(input: {
  startsAt: string | null | undefined;
  eventDate: string;
  now?: Date;
  timeZone?: string | null;
}): { label: string; announce: string; started: boolean; within24h: boolean } {
  const now = input.now ?? new Date();
  if (!input.startsAt) {
    const days = daysBetween(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: input.timeZone || "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now),
      input.eventDate,
    );
    if (days > 1) {
      const label = `${days} days left`;
      return { label, announce: label, started: false, within24h: false };
    }
    if (days === 1) return { label: "1 day left", announce: "1 day left", started: false, within24h: false };
    if (days === 0) return { label: "Race day", announce: "Race day — add start time", started: false, within24h: true };
    return { label: "Add start time", announce: "Start time missing", started: true, within24h: false };
  }

  const ms = Date.parse(input.startsAt) - now.getTime();
  if (ms <= 0) {
    return { label: "Race underway", announce: "Race has started", started: true, within24h: true };
  }

  const hoursTotal = ms / 3_600_000;
  if (hoursTotal > 24) {
    const days = Math.ceil(hoursTotal / 24);
    const label = days === 1 ? "1 day left" : `${days} days left`;
    return { label, announce: label, started: false, within24h: false };
  }

  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  let label: string;
  if (hours <= 0) label = `${minutes} min left`;
  else if (minutes <= 0) label = `${hours}h left`;
  else label = `${hours}h ${minutes}m left`;
  return { label, announce: label, started: false, within24h: true };
}

export function kitItemsFromChecklist(checklist: ChecklistItem[]): ChecklistItem[] {
  const order = new Map<string, number>(RACE_KIT_IDS.map((id, index) => [id, index]));
  return checklist
    .filter((item) => order.has(item.id))
    .sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
}

export function computeKitProgress(checklist: ChecklistItem[]): KitProgress {
  const items = kitItemsFromChecklist(checklist);
  const done = items.filter((item) => item.done).length;
  const total = items.length || RACE_KIT_IDS.length;
  const next = items.find((item) => !item.done) ?? null;
  const ready = items.length > 0 && done === items.length;
  return {
    done,
    total,
    label: ready ? "Kit ready" : `${done} of ${total} packed`,
    ready,
    next,
    items,
  };
}

export function defaultChecklist(priority: EventPriority): ChecklistItem[] {
  const items: ChecklistItem[] = [
    { id: "collect_bib", label: "Collect bib", section: "prepare", done: false },
    { id: "confirm_transport", label: "Confirm transport", section: "prepare", done: false },
    { id: "pack_kit", label: "Pack kit", section: "prepare", done: false },
    { id: "choose_breakfast", label: "Choose race breakfast", section: "fuel", done: false },
    { id: "pack_fuel", label: "Pack fuel", section: "fuel", done: false },
    { id: "gentle_mobility", label: "Optional gentle mobility", section: "prepare", done: false, optional: true },
    { id: "race_morning_meal", label: "Race morning meal", section: "race_day", done: false },
    { id: "depart", label: "Leave for venue", section: "race_day", done: false },
    { id: "check_in", label: "Arrive and check in", section: "race_day", done: false },
    { id: "log_result", label: "Log race result", section: "recover", done: false },
    { id: "recovery_checkin", label: "Recovery check-in", section: "recover", done: false },
  ];
  if (priority === "practice") {
    return items.filter((item) => item.id !== "pack_fuel" || true);
  }
  return items;
}

export function mergeChecklist(
  defaults: ChecklistItem[],
  saved: ChecklistItem[] | null | undefined,
): ChecklistItem[] {
  if (!saved?.length) return defaults;
  const byId = new Map(saved.map((item) => [item.id, item]));
  return defaults.map((item) => {
    const prev = byId.get(item.id);
    if (!prev) return item;
    return {
      ...item,
      done: Boolean(prev.done),
      doneAt: prev.doneAt ?? null,
      label: prev.label || item.label,
    };
  });
}

export function resolveRacePrepPhase(input: {
  today: string;
  eventDate: string;
  hasResult: boolean;
  hasRecoveryCheckIn: boolean;
}): RacePrepPhase {
  if (input.hasResult && input.hasRecoveryCheckIn) return "recover";
  if (input.today > input.eventDate) return input.hasResult ? "recover" : "result";
  if (input.today === input.eventDate) return "race_day";
  const days = daysBetween(input.today, input.eventDate);
  if (days === 1) return "fuel";
  return "prepare";
}

export function openSectionForPhase(phase: RacePrepPhase): "prepare" | "fuel" | "race_day" | "recover" {
  if (phase === "race_day") return "race_day";
  if (phase === "fuel") return "fuel";
  if (phase === "recover" || phase === "result") return "recover";
  return "prepare";
}

/**
 * Build a race-day timeline anchored to start time.
 * Invents nothing when start time is missing.
 */
export function buildRaceDayTimeline(input: {
  startsAt: string | null;
  timeZone?: string | null;
  checkInClosesAt?: string | null;
  travelMinutes?: number | null;
  arrivalBufferMin?: number | null;
  estimatedDurationMin?: number | null;
  saved?: TimelineItem[] | null;
}): TimelineItem[] {
  const savedById = new Map((input.saved ?? []).map((item) => [item.id, item]));
  const mark = (id: string, label: string, at: string | null, offsetMin: number | null, action?: string): TimelineItem => {
    const prev = savedById.get(id);
    return {
      id,
      label,
      at,
      offsetMin,
      done: Boolean(prev?.done),
      action: action ?? prev?.action ?? null,
      conflict: prev?.at && at && prev.at !== at && prev.done === false
        ? "Suggested time changed — review your manual time."
        : prev?.conflict ?? null,
    };
  };

  if (!input.startsAt) {
    return [
      mark("add_start", "Add start time", null, null, "Add start time"),
      mark("breakfast", "Race breakfast (once start time is set)", null, null),
      mark("depart", "Depart for venue", null, null),
      mark("arrive", "Arrive and check in", null, null),
      mark("warmup", "Optional warm-up", null, null),
      mark("start", "Race start", null, null),
    ];
  }

  const start = input.startsAt;
  const travel = Math.max(0, input.travelMinutes ?? 45);
  const buffer = Math.max(15, input.arrivalBufferMin ?? 45);
  const checkIn = input.checkInClosesAt;
  const arriveAt = checkIn
    ? addMinutes(checkIn, -Math.max(10, buffer / 2))
    : addMinutes(start, -(travel + buffer));
  const departAt = addMinutes(arriveAt, -travel);

  // Adapt meal offsets by start hour in the event zone.
  let startHour = 8;
  try {
    startHour = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: input.timeZone || "UTC",
        hour: "numeric",
        hourCycle: "h23",
      }).format(new Date(start)),
    );
  } catch {
    startHour = new Date(start).getUTCHours();
  }

  const breakfastOffset = startHour < 10 ? -150 : startHour < 14 ? -240 : -360;
  const lunchOffset = startHour >= 14 ? -180 : null;
  const preRaceSnackOffset = startHour >= 12 ? -75 : -90;

  const items: TimelineItem[] = [
    mark("wake", startHour < 9 ? "Wake up" : "Morning routine", addMinutes(start, breakfastOffset - 30), breakfastOffset - 30),
    mark("breakfast", "Race breakfast", addMinutes(start, breakfastOffset), breakfastOffset, "Mark breakfast done"),
  ];
  if (lunchOffset != null) {
    items.push(mark("lunch", "Race-day lunch", addMinutes(start, lunchOffset), lunchOffset));
  }
  items.push(
    mark("pre_race_fuel", "Pre-race snack / sip", addMinutes(start, preRaceSnackOffset), preRaceSnackOffset),
    mark("depart", "Depart for venue", departAt, null, "Open directions"),
    mark("arrive", "Arrive and check in", arriveAt, null),
    mark("warmup", "Optional warm-up", addMinutes(start, -25), -25),
    mark("start", "Race start", start, 0),
  );
  if (input.estimatedDurationMin && input.estimatedDurationMin > 0) {
    items.push(mark("finish", "Estimated finish window", addMinutes(start, input.estimatedDurationMin), input.estimatedDurationMin));
  }
  return items.sort((a, b) => {
    if (a.at && b.at) return Date.parse(a.at) - Date.parse(b.at);
    if (a.at) return -1;
    if (b.at) return 1;
    return 0;
  });
}

export function defaultFuelSlots(input: {
  dietaryPattern?: string | null;
  allergies?: string[] | null;
  expectedHours?: number | null;
  familiarFoods?: string[] | null;
}): FuelSlot[] {
  const familiar = input.familiarFoods?.length
    ? input.familiarFoods
    : ["Oatmeal with banana", "Toast with honey", "Rice bowl", "Familiar sports drink"];
  const dietNote = input.dietaryPattern && input.dietaryPattern !== "none"
    ? `Keep choices ${input.dietaryPattern}.`
    : "Use only foods you already tolerate.";
  const allergyNote = input.allergies?.length ? `Avoid: ${input.allergies.join(", ")}.` : null;
  const hours = input.expectedHours ?? 1;
  const duringRelevant = hours >= 1;

  return [
    {
      id: "day_before",
      title: "Day Before",
      suggestions: [
        "Familiar carbohydrate-rich dinner",
        "Hydrate steadily — no novel products",
        dietNote,
        allergyNote,
      ].filter(Boolean) as string[],
      tried: [],
    },
    {
      id: "race_morning",
      title: hours >= 3 || (input.expectedHours == null) ? "Race Morning" : "Pre-Race",
      suggestions: familiar.slice(0, 3),
      preferred: null,
      tried: [],
    },
    {
      id: "during",
      title: "During the Race",
      suggestions: duringRelevant
        ? [
          hours >= 3 ? "Practiced gels or drink every 20–30 min when tolerated" : "Optional small carbohydrate top-ups if needed",
          "Use flavors already tested in training",
          "Aid-station water as needed — no universal ml/h target",
        ]
        : ["Usually unnecessary beyond water for this duration"],
      tried: [],
      carry: null,
      aidStations: null,
    },
    {
      id: "after",
      title: "After the Finish",
      suggestions: [
        "Fluids first",
        "Carbohydrate + protein snack within a few hours",
        "Continue normal meals; do not force a huge surplus",
      ],
      tried: [],
    },
  ];
}

export function mergeFuelSlots(defaults: FuelSlot[], saved: FuelSlot[] | null | undefined): FuelSlot[] {
  if (!saved?.length) return defaults;
  const byId = new Map(saved.map((slot) => [slot.id, slot]));
  return defaults.map((slot) => {
    const prev = byId.get(slot.id);
    if (!prev) return slot;
    return {
      ...slot,
      preferred: prev.preferred ?? slot.preferred,
      tried: prev.tried?.length ? prev.tried : slot.tried,
      carry: prev.carry ?? slot.carry,
      aidStations: prev.aidStations ?? slot.aidStations,
      notes: prev.notes ?? slot.notes,
      suggestions: prev.suggestions?.length ? prev.suggestions : slot.suggestions,
    };
  });
}

export function buildRacePrepSnapshot(input: {
  event: PolicyEvent & {
    startsAt?: string | null;
    checkInClosesAt?: string | null;
    travelMinutes?: number | null;
    arrivalBufferMin?: number | null;
    estimatedDurationMin?: number | null;
    location?: string | null;
  };
  today: string;
  trainingPhase?: EventPhaseType | null;
  checklist?: ChecklistItem[] | null;
  timeline?: TimelineItem[] | null;
  fuel?: FuelSlot[] | null;
  hasResult?: boolean;
  hasRecoveryCheckIn?: boolean;
  scheduleNotes?: string[];
  dietaryPattern?: string | null;
  allergies?: string[] | null;
  expectedHours?: number | null;
}): RacePrepSnapshot {
  const eventDate = eventLocalDate(input.event);
  const daysUntil = daysBetween(input.today, eventDate);
  const phase = resolveRacePrepPhase({
    today: input.today,
    eventDate,
    hasResult: Boolean(input.hasResult),
    hasRecoveryCheckIn: Boolean(input.hasRecoveryCheckIn),
  });
  const section = openSectionForPhase(phase);
  const checklist = mergeChecklist(defaultChecklist(input.event.priority), input.checklist);
  const { timeLabel, zoneLabel } = formatStartInZone(input.event.startsAt ?? null, input.event.timezone);
  const timeline = buildRaceDayTimeline({
    startsAt: input.event.startsAt ?? null,
    timeZone: input.event.timezone,
    checkInClosesAt: input.event.checkInClosesAt,
    travelMinutes: input.event.travelMinutes,
    arrivalBufferMin: input.event.arrivalBufferMin,
    estimatedDurationMin: input.event.estimatedDurationMin,
    saved: input.timeline,
  });
  const fuel = mergeFuelSlots(
    defaultFuelSlots({
      dietaryPattern: input.dietaryPattern,
      allergies: input.allergies,
      expectedHours: input.expectedHours,
    }),
    input.fuel,
  );

  const kitProgress = computeKitProgress(checklist);
  const nextChecklist = kitProgress.next
    ?? checklist.find((item) => !item.done && (phase === "race_day" ? item.section === "race_day" || item.section === "fuel" : item.section === section || (phase === "prepare" && item.section === "prepare")))
    ?? checklist.find((item) => !item.done)
    ?? null;
  const nextTimeline = phase === "race_day" ? timeline.find((item) => !item.done && item.id !== "add_start") ?? timeline.find((item) => !item.done) ?? null : null;
  const nextTask = phase === "race_day" ? (nextTimeline ?? nextChecklist) : nextChecklist;

  const done = checklist.filter((item) => item.done).length;
  const taper = individualizeTaper({
    templateSlug: input.event.templateSlug ?? null,
    discipline: input.event.discipline,
    distanceM: input.event.distanceM ?? null,
    priority: input.event.priority,
    daysUntilEvent: Math.max(0, daysUntil),
  });

  let cardTitle = "Race Prep";
  let cardSubtitle = kitProgress.ready
    ? "Kit ready"
    : kitProgress.next
      ? `Up next: ${kitProgress.next.label}`
      : nextTask && "label" in nextTask
        ? `Next: ${nextTask.label}`
        : "Open checklist";
  if (phase === "fuel" && daysUntil === 1) {
    cardTitle = "Recovery Day";
    cardSubtitle = kitProgress.ready ? "Kit ready · fueling prep" : "Packing and fueling preparation";
  } else if (phase === "race_day") {
    cardTitle = "Race Day";
    cardSubtitle = nextTask && "label" in nextTask ? `Next: ${nextTask.label}` : "Follow your timeline";
  } else if (phase === "result") {
    cardTitle = "Log Race Result";
    cardSubtitle = "Save finish details when ready";
  } else if (phase === "recover") {
    cardTitle = input.hasRecoveryCheckIn ? "Recovery" : "Recovery Check-In";
    cardSubtitle = input.hasRecoveryCheckIn ? "Gradual return to your sports" : "How do you feel after the race?";
  }

  const countdown = formatRaceCountdown({
    startsAt: input.event.startsAt ?? null,
    eventDate,
    timeZone: input.event.timezone,
  });
  const startTimeLabel = formatLocalStartTime(input.event.startsAt ?? null, input.event.timezone);
  const timeZoneDisplay = timeZoneDisplayName(input.event.timezone);
  const eventDateLabel = formatEventDateLabel(eventDate);

  return {
    eventId: input.event.id,
    eventName: input.event.name,
    phase,
    section,
    daysUntil,
    countdownLabel: countdown.label,
    countdownAnnounce: countdown.announce,
    startLabel: startTimeLabel
      ? (timeZoneDisplay ? `${startTimeLabel} · ${timeZoneDisplay}` : startTimeLabel)
      : timeLabel,
    startTimeLabel,
    timeZoneDisplay,
    timeZoneLabel: zoneLabel,
    needsStartTime: !input.event.startsAt,
    eventDateLabel,
    nextTask,
    checklist,
    checklistProgress: { done, total: checklist.length },
    kitProgress,
    timeline,
    fuel,
    scheduleNotes: input.scheduleNotes ?? [
      `Taper window ~${taper.taperDays} days for this ${input.event.priority} event.`,
      "Day before is recovery-only; race day shows the event instead of regular training.",
    ],
    cardTitle,
    cardSubtitle,
    imageUrl: null,
  };
}

export function prepWindowOpen(input: {
  today: string;
  eventDate: string;
  priority: EventPriority;
  discipline: string;
  distanceM?: number | null;
  templateSlug?: string | null;
}): boolean {
  const daysUntil = daysBetween(input.today, input.eventDate);
  if (daysUntil < -14) return false;
  if (daysUntil < 0) return true; // post-race result / recovery
  const taper = individualizeTaper({
    templateSlug: input.templateSlug ?? null,
    discipline: input.discipline,
    distanceM: input.distanceM ?? null,
    priority: input.priority,
    daysUntilEvent: daysUntil,
  });
  const windowDays = Math.max(taper.taperDays + 3, input.priority === "practice" ? 5 : 10);
  return daysUntil <= windowDays;
}
