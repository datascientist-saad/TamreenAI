import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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

export function sportLabel(sport: string): string {
  const labels: Record<string, string> = {
    strength: "Strength",
    bodybuilding: "Hypertrophy",
    running: "Run",
    cycling: "Bike",
    swimming: "Swim",
    brick: "Brick",
    mobility: "Mobility",
    recovery: "Recovery",
    triathlon: "Triathlon",
  };
  return labels[sport] ?? sport;
}

export function intensityLabel(intensity: string): string {
  return intensity.replaceAll("_", " ");
}
