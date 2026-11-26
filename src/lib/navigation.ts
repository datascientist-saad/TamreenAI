/** Safe in-app return paths and parent fallbacks for detail screens. */

const ALLOWED_PREFIXES = [
  "/home",
  "/plan",
  "/train",
  "/progress",
  "/more",
  "/events",
  "/calendar",
  "/conflicts",
  "/live",
  "/log",
  "/recovery",
  "/health",
  "/nutrition",
  "/records",
  "/analytics",
  "/weekly",
  "/ai",
  "/profile",
  "/settings",
  "/notifications",
  "/triathlon",
  "/runs",
] as const;

export type DetailKind = "event" | "workout" | "nutrition" | "progress" | "live" | "generic";

const PARENTS: Record<DetailKind, string> = {
  event: "/events",
  workout: "/train",
  nutrition: "/nutrition",
  progress: "/progress",
  live: "/live",
  generic: "/home",
};

/** Encode the current list/context URL so a detail screen can return to it. */
export function withReturnTo(href: string, returnTo?: string | null): string {
  if (!returnTo) return href;
  const safe = sanitizeReturnTo(returnTo);
  if (!safe) return href;
  const join = href.includes("?") ? "&" : "?";
  return `${href}${join}from=${encodeURIComponent(safe)}`;
}

export function sanitizeReturnTo(value: string | null | undefined): string | null {
  if (!value) return null;
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    decoded = value;
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//")) return null;
  if (decoded.includes("://") || decoded.includes("\\")) return null;
  const path = decoded.split("?")[0] ?? decoded;
  const allowed = ALLOWED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  return allowed ? decoded : null;
}

export function resolveBackHref(from: string | null | undefined, kind: DetailKind): string {
  return sanitizeReturnTo(from) ?? PARENTS[kind];
}

export function backLabel(href: string, kind: DetailKind): string {
  const path = href.split("?")[0] ?? href;
  if (path === "/home" || path.startsWith("/home/")) return "Today";
  if (path === "/plan" || path.startsWith("/plan/") || path.startsWith("/calendar")) return "Plan";
  if (path === "/events" || path.startsWith("/events/")) return "Events";
  if (path === "/train" || path.startsWith("/train/")) return "Train";
  if (path === "/progress" || path.startsWith("/progress/")) return "Progress";
  if (path === "/nutrition") return "Nutrition";
  if (path === "/recovery") return "Recovery";
  if (path === "/live" || path.startsWith("/live/")) return "Live";
  if (path === "/more") return "More";
  return PARENTS[kind] === href ? defaultParentLabel(kind) : "Back";
}

function defaultParentLabel(kind: DetailKind): string {
  switch (kind) {
    case "event":
      return "Events";
    case "workout":
      return "Train";
    case "nutrition":
      return "Nutrition";
    case "progress":
      return "Progress";
    case "live":
      return "Live";
    default:
      return "Today";
  }
}

/** Monday-based ISO week containing `iso` (UTC date string). */
export function weekStartMonday(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  const day = date.getUTCDay(); // 0 Sun … 6 Sat
  const delta = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export function buildPlanHref(opts: {
  week?: string | null;
  day?: string | null;
  tab?: "schedule" | "events" | null;
  view?: string | null;
}): string {
  const params = new URLSearchParams();
  if (opts.week) params.set("week", opts.week);
  if (opts.day) params.set("day", opts.day);
  if (opts.tab) params.set("tab", opts.tab);
  if (opts.view) params.set("view", opts.view);
  const qs = params.toString();
  return qs ? `/plan?${qs}` : "/plan";
}

export function buildEventsHref(opts?: { scroll?: string | null }): string {
  if (opts?.scroll) return `/events#${opts.scroll}`;
  return "/events";
}
