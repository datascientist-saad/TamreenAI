import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { sportLabels, type SportSlug } from "./sports";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function todayInTimeZone(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function hourInTimeZone(timeZone: string): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date()),
  );
}

export function greeting(name: string, hour: number): string {
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = name.trim().split(" ")[0] || "athlete";
  return `${hello}, ${first}.`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function formatPace(secondsPerKm: number, unit: "km" | "mi"): string {
  const seconds = unit === "mi" ? secondsPerKm * 1.60934 : secondsPerKm;
  const minutes = Math.floor(seconds / 60);
  const remain = Math.round(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remain}/${unit}`;
}

export function formatClock(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.round(totalSeconds % 60);
  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export type ClockParse = { ok: true; seconds: number | null } | { ok: false; message: string };

export function clockFromParts(hours: unknown, minutes: unknown, seconds: unknown): ClockParse {
  const raw = [hours, minutes, seconds].map((value) => (value == null ? "" : String(value).trim()));
  if (raw.every((part) => part === "")) return { ok: true, seconds: null };
  const nums = raw.map((part) => (part === "" ? 0 : Number(part)));
  if (nums.some((value) => !Number.isInteger(value) || value < 0)) {
    return { ok: false, message: "Use whole hours, minutes, and seconds." };
  }
  const [hour, minute, second] = nums;
  if (hour > 99) return { ok: false, message: "Hours stay under 100." };
  if (minute > 59 || second > 59) return { ok: false, message: "Minutes and seconds stay under 60." };
  const total = hour * 3600 + minute * 60 + second;
  return { ok: true, seconds: total > 0 ? total : null };
}

export function parsePaceList(value: string): { ok: true; seconds: number[] } | { ok: false; message: string } {
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  const seconds: number[] = [];
  for (const part of parts) {
    const bits = part.split(":").map((bit) => bit.trim());
    const parsed = bits.length === 2
      ? clockFromParts(0, bits[0], bits[1])
      : bits.length === 3
        ? clockFromParts(bits[0], bits[1], bits[2])
        : null;
    if (!parsed || !parsed.ok || parsed.seconds == null) {
      return { ok: false, message: "Write each split as minutes:seconds, like 5:30." };
    }
    seconds.push(parsed.seconds);
  }
  return { ok: true, seconds };
}

export function kgToDisplay(kg: number, unit: "kg" | "lb"): string {
  const value = unit === "lb" ? kg * 2.2046226218 : kg;
  const rounded = Math.round(value * 10) / 10;
  return `${rounded} ${unit}`;
}

export function displayToKg(value: number, unit: "kg" | "lb"): number {
  return unit === "lb" ? value / 2.2046226218 : value;
}

export function kmToDisplay(km: number, unit: "km" | "mi"): string {
  const value = unit === "mi" ? km / 1.60934 : km;
  return `${Math.round(value * 10) / 10} ${unit}`;
}

export function daysUntil(iso: string, today: string): number {
  const start = Date.parse(`${today}T00:00:00Z`);
  const end = Date.parse(`${iso}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

export function shiftIsoDate(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function sportLabel(sport: string): string {
  const short: Record<string, string> = {
    bodybuilding: "Hypertrophy",
    running: "Run",
    cycling: "Bike",
    swimming: "Swim",
    brick: "Brick",
    mobility: "Mobility",
    recovery: "Recovery",
  };
  if (sport in short) return short[sport];
  if (sport in sportLabels) return sportLabels[sport as SportSlug];
  return sport;
}

export function intensityLabel(intensity: string): string {
  return intensity.replaceAll("_", " ");
}
