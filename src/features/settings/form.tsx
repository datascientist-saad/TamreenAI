"use client";

import { useState } from "react";
import { updateSettings } from "@/server/actions";

export function SettingsForm({
  unitSystem,
  distanceUnit,
  weightUnit,
  theme,
  notifications,
}: {
  unitSystem: "metric" | "imperial";
  distanceUnit: "km" | "mi";
  weightUnit: "kg" | "lb";
  theme: "system" | "light" | "dark";
  notifications: Record<string, boolean>;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setError(null);
    const nextTheme = String(formData.get("theme")) as "system" | "light" | "dark";
    try {
      await updateSettings({
        unitSystem: String(formData.get("unitSystem")) as "metric" | "imperial",
        distanceUnit: String(formData.get("distanceUnit")) as "km" | "mi",
        weightUnit: String(formData.get("weightUnit")) as "kg" | "lb",
        theme: nextTheme,
        notifications: {
          workout: formData.get("workout") === "on",
          recovery: formData.get("recovery") === "on",
          conflicts: formData.get("conflicts") === "on",
          prs: formData.get("prs") === "on",
          events: formData.get("events") === "on",
          coach: formData.get("coach") === "on",
          plan: formData.get("plan") === "on",
        },
      });
      const dark = nextTheme === "dark" || (nextTheme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", dark);
      localStorage.setItem("tamreen-theme", nextTheme === "system" ? "" : nextTheme);
      setMessage("Settings saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Settings were not saved.");
    }
  }

  return (
    <form action={submit} className="grid gap-3">
      <label>Units
        <select name="unitSystem" defaultValue={unitSystem}>
          <option value="metric">Metric</option>
          <option value="imperial">Imperial</option>
        </select>
      </label>
      <label>Distance
        <select name="distanceUnit" defaultValue={distanceUnit}>
          <option value="km">Kilometres</option>
          <option value="mi">Miles</option>
        </select>
      </label>
      <label>Weight
        <select name="weightUnit" defaultValue={weightUnit}>
          <option value="kg">Kilograms</option>
          <option value="lb">Pounds</option>
        </select>
      </label>
      <label>Appearance
        <select name="theme" defaultValue={theme}>
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
      <fieldset className="grid gap-2">
        <legend className="font-bold">Notifications</legend>
        {Object.entries({
          workout: "Workout reminder",
          recovery: "Recovery warning",
          conflicts: "Training conflict",
          prs: "New record",
          events: "Event countdown",
          coach: "Coach feedback",
          plan: "Plan adjustment",
        }).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 font-medium">
            <input className="h-5 w-5" name={key} type="checkbox" defaultChecked={notifications[key] !== false} /> {label}
          </label>
        ))}
      </fieldset>
      {message ? <p className="text-sm">{message}</p> : null}
      {error ? <p className="text-sm text-live">{error}</p> : null}
      <button className="btn btn-primary" type="submit">Save settings</button>
    </form>
  );
}
