"use client";

import { useEffect } from "react";

/**
 * Syncs the server-persisted theme preference to localStorage on every
 * authenticated page load. This ensures that the sidebar ThemeToggle (which
 * reads localStorage) agrees with what the user saved in Settings, even on a
 * fresh device where localStorage is empty.
 *
 * The sync is intentionally one-way: server → localStorage. The ThemeToggle
 * remains the source of truth for per-session overrides and keeps writing to
 * both localStorage and the DB.
 */
export function ThemeSync({ serverTheme }: { serverTheme: "light" | "dark" | "system" }) {
  useEffect(() => {
    const local = localStorage.getItem("tamreen-theme");
    const localChoice = local === "dark" || local === "light" ? local : "system";
    if (localChoice === serverTheme) return;
    // localStorage is out of sync with the DB — apply the server value.
    const dark =
      serverTheme === "dark" ||
      (serverTheme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("tamreen-theme", serverTheme === "system" ? "" : serverTheme);
  }, [serverTheme]);

  return null;
}
