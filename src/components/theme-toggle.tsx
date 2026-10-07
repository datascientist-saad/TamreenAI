"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { updateTheme } from "@/server/actions";
import { cn } from "@/lib/utils";

type ThemeChoice = "light" | "dark" | "system";

const options: Array<{ id: ThemeChoice; label: string; icon: typeof Sun }> = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
];

const listeners = new Set<() => void>();

export function ThemeToggle({ persist = true, onDark = false }: { persist?: boolean; onDark?: boolean }) {
  const mode = useSyncExternalStore(subscribe, readTheme, () => "system" as ThemeChoice);

  function choose(next: ThemeChoice) {
    applyTheme(next);
    for (const listener of listeners) listener();
    if (!persist) return;
    void updateTheme(next).catch(() => undefined);
  }

  return (
    <div className={cn("grid grid-cols-3 gap-1 rounded-2xl border p-1", onDark ? "border-white/20 bg-white/10" : "border-line bg-paper")} role="group" aria-label="Appearance">
      {options.map((option) => {
        const Icon = option.icon;
        const selected = mode === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            aria-label={option.label}
            title={option.label}
            className={cn(
              "grid min-h-10 min-w-10 place-items-center rounded-xl text-xs font-bold",
              selected
                ? onDark ? "bg-white text-maroon-deep" : "bg-maroon text-white"
                : onDark ? "text-white" : "text-muted",
            )}
            onClick={() => choose(option.id)}
          >
            <Icon size={16} />
            <span className="sr-only">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (readTheme() === "system") applyTheme("system");
    callback();
  };
  media.addEventListener("change", onChange);
  return () => {
    listeners.delete(callback);
    media.removeEventListener("change", onChange);
  };
}

function readTheme(): ThemeChoice {
  const stored = window.localStorage.getItem("tamreen-theme");
  if (stored === "dark" || stored === "light") return stored;
  return "system";
}

function applyTheme(next: ThemeChoice) {
  const dark = next === "dark" || (next === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  window.localStorage.setItem("tamreen-theme", next === "system" ? "" : next);
}
