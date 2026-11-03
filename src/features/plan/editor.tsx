"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GripVertical } from "lucide-react";
import { moveWorkout, optimizeOpenConflicts, setWorkoutStatus } from "@/server/actions";
import { formatDuration, intensityLabel, shiftIsoDate, sportLabel } from "@/lib/utils";
import { OptimizeButton } from "./optimize-button";
import { RebuildPlanButton } from "./rebuild-button";
import { StatusChoices } from "./status-choices";
import {
  datesBetween,
  dayHeading,
  statusLabel,
  type PlanBlock,
  type PlanWorkout,
} from "./model";

const views = ["today", "week", "month", "block"] as const;
type View = (typeof views)[number];

function asView(value: string): View {
  return views.includes(value as View) ? value as View : "week";
}

export function PlanEditor({
  today,
  initialView,
  lockView = false,
  showRebuild = false,
  blocks,
  workouts,
}: {
  today: string;
  initialView: string;
  lockView?: boolean;
  showRebuild?: boolean;
  blocks: PlanBlock[];
  workouts: PlanWorkout[];
}) {
  const router = useRouter();
  const [view, setView] = useState<View>(asView(initialView));
  const [items, setItems] = useState(workouts);
  const [overDay, setOverDay] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ title: string; x: number; y: number } | null>(null);
  const [conflict, setConflict] = useState<{ id: string; date: string; message: string } | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const inflight = useRef(0);
  const dragRef = useRef<{ id: string; origin: string } | null>(null);
  const overRef = useRef<string | null>(null);
  const expected = useRef<Array<{ id: string; date: string }>>([]);
  const itemsRef = useRef(items);
  const stamp = workouts.map((workout) => `${workout.id}:${workout.scheduled_date}:${workout.status}`).join("|");

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    if (expected.current.length) {
      const ready = expected.current.every((move) => workouts.some((workout) => workout.id === move.id && workout.scheduled_date === move.date));
      if (!ready) return;
      expected.current = [];
    }
    if (inflight.current === 0) setItems(workouts);
  }, [stamp, workouts]);

  const monthStart = `${today.slice(0, 7)}-01`;
  const monthEndDate = new Date(`${monthStart}T00:00:00Z`);
  monthEndDate.setUTCMonth(monthEndDate.getUTCMonth() + 1);
  monthEndDate.setUTCDate(0);
  const monthEnd = monthEndDate.toISOString().slice(0, 10);
  const currentBlock = blocks.find((block) => block.start_date <= today && block.end_date >= today) ?? blocks[0];
  const primary = view === "today"
    ? [today]
    : view === "week"
      ? datesBetween(today, shiftIsoDate(today, 6))
      : view === "month"
        ? datesBetween(monthStart, monthEnd)
        : currentBlock
          ? datesBetween(currentBlock.start_date, currentBlock.end_date)
          : [today];
  const extra = view === "today" ? datesBetween(shiftIsoDate(today, 1), shiftIsoDate(today, 6)) : [];

  function patch(id: string, update: Partial<PlanWorkout>) {
    setItems((list) => list.map((workout) => workout.id === id ? { ...workout, ...update } : workout));
  }

  async function relocate(id: string, date: string, confirm = false) {
    const current = itemsRef.current.find((workout) => workout.id === id);
    if (!current || current.scheduled_date === date || current.status === "completed") return;
    const previousDate = current.scheduled_date;
    const previousStatus = current.status;
    setError("");
    setBusyId(id);
    inflight.current += 1;
    patch(id, { scheduled_date: date, status: "moved" });
    try {
      const result = await moveWorkout(id, date, confirm);
      if (!result.ok) {
        patch(id, { scheduled_date: previousDate, status: previousStatus });
        setConflict({
          id,
          date,
          message: result.conflicts.map((item) => `${item.title}. ${item.explanation}`).join(" "),
        });
        return;
      }
      setConflict(null);
      router.refresh();
    } catch (caught) {
      patch(id, { scheduled_date: previousDate, status: previousStatus });
      setError(caught instanceof Error ? caught.message : "The workout was not moved.");
    } finally {
      inflight.current = Math.max(0, inflight.current - 1);
      setBusyId(null);
    }
  }

  async function choose(id: string, next: "skipped" | "missed" | "planned") {
    const current = items.find((workout) => workout.id === id);
    if (!current) return;
    const previous = current.status;
    setError("");
    setBusyId(id);
    inflight.current += 1;
    patch(id, { status: next });
    try {
      await setWorkoutStatus(id, next);
      router.refresh();
    } catch (caught) {
      patch(id, { status: previous });
      setError(caught instanceof Error ? caught.message : "Status was not saved.");
    } finally {
      inflight.current = Math.max(0, inflight.current - 1);
      setBusyId(null);
    }
  }

  function applyOptimized(result: Awaited<ReturnType<typeof optimizeOpenConflicts>>) {
    if (!result.changes.length) return;
    expected.current = result.changes.map((change) => ({ id: change.id, date: change.toDate }));
    setItems((list) => list.map((workout) => {
      const change = result.changes.find((item) => item.id === workout.id);
      return change ? { ...workout, scheduled_date: change.toDate, status: "moved" } : workout;
    }));
  }

  function beginDrag(event: PointerEvent<HTMLButtonElement>, workout: PlanWorkout) {
    if (workout.status === "completed" || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { id: workout.id, origin: workout.scheduled_date };
    overRef.current = workout.scheduled_date;
    setOverDay(workout.scheduled_date);
    setGhost({ title: workout.title, x: event.clientX, y: event.clientY });
  }

  function trackDrag(event: PointerEvent<HTMLButtonElement>) {
    if (!dragRef.current) return;
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    const day = hit?.closest("[data-day]")?.getAttribute("data-day") ?? null;
    overRef.current = day;
    setOverDay(day);
    setGhost((current) => current ? { ...current, x: event.clientX, y: event.clientY } : current);
  }

  function endDrag() {
    const current = dragRef.current;
    const day = overRef.current;
    dragRef.current = null;
    overRef.current = null;
    setGhost(null);
    setOverDay(null);
    if (current && day && day !== current.origin) void relocate(current.id, day);
  }

  const sections = [
    { key: "primary", title: "", dates: primary },
    extra.length ? { key: "extra", title: "Drop on another day", dates: extra } : null,
  ].filter((section): section is { key: string; title: string; dates: string[] } => Boolean(section));

  return (
    <div className="grid gap-4">
      <div className="sticky top-16 z-20 -mx-4 flex flex-wrap items-start gap-2 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur md:top-0">
        {lockView ? null : views.map((item) => (
          <button
            key={item}
            type="button"
            className={`btn min-h-10 capitalize ${view === item ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setView(item)}
          >
            {item}
          </button>
        ))}
        {showRebuild ? <RebuildPlanButton /> : null}
        <OptimizeButton onResult={applyOptimized} />
      </div>
      <p className="text-sm text-muted">Drag a workout by the handle, or pick a date. The day updates immediately. Skip means you chose not to do it. Missed means it passed and was not done.</p>
      {error ? <p className="text-sm text-live" aria-live="polite">{error}</p> : null}
      {conflict ? (
        <div className="rounded-2xl border border-live/40 bg-live/10 p-4 text-sm">
          <p className="font-bold">Training conflict detected</p>
          <p className="mt-1">{conflict.message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn btn-primary" type="button" onClick={() => void relocate(conflict.id, conflict.date, true)}>Move anyway</button>
            <button className="btn btn-ghost" type="button" onClick={() => setConflict(null)}>Keep the original day</button>
          </div>
        </div>
      ) : null}
      {view === "block" ? (
        <ul className="grid gap-2">
          {blocks.map((block) => (
            <li key={block.id} className="app-card p-4">
              <p className="eyebrow">{block.phase}</p>
              <h2 className="font-bold">{block.name}</h2>
              <p className="text-sm text-muted">{block.start_date} → {block.end_date}. {block.focus}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {sections.map((section) => (
        <div key={section.key} className="grid gap-3">
          {section.title ? <h2 className="text-lg font-extrabold">{section.title}</h2> : null}
          <div className={`grid gap-3 ${view === "month" ? "sm:grid-cols-2 xl:grid-cols-3" : ""}`}>
            {section.dates.map((date) => {
              const rows = items.filter((workout) => workout.scheduled_date === date);
              const active = overDay === date;
              return (
                <section
                  key={date}
                  id={date}
                  data-day={date}
                  className={`grid min-h-28 gap-3 rounded-3xl p-3 ${date === today ? "bg-maroon/10 ring-2 ring-maroon" : "bg-card/40"} ${active ? "ring-2 ring-gold" : ""}`}
                >
                  <h2 className="px-1 text-lg font-extrabold">{dayHeading(date, today)}</h2>
                  {rows.length === 0 ? <p className="px-1 text-sm text-muted">Rest. Drop a workout here.</p> : null}
                  {rows.map((workout) => (
                    <article key={workout.id} className="app-card p-4" data-day={date}>
                      <div className="flex items-start gap-2">
                        {workout.status === "completed" ? <span className="w-10" /> : (
                          <button
                            type="button"
                            className="grid h-11 w-11 shrink-0 cursor-grab touch-none place-items-center rounded-xl border border-line text-muted active:cursor-grabbing"
                            aria-label={`Drag ${workout.title} to another day`}
                            onPointerDown={(event) => beginDrag(event, workout)}
                            onPointerMove={trackDrag}
                            onPointerUp={endDrag}
                            onPointerCancel={endDrag}
                          >
                            <GripVertical size={18} />
                          </button>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className={`chip sport-${workout.sport}`}>{sportLabel(workout.sport)}</span>
                            <span className={`chip ${workout.status === "missed" ? "bg-live/15 text-live" : workout.status === "skipped" ? "bg-gold/30 text-ink" : "bg-paper text-muted"}`}>
                              {statusLabel(workout.status)}
                            </span>
                          </div>
                          <h3 className="mt-2 text-xl font-bold">{workout.title}</h3>
                          <p className="metric text-sm text-muted">{formatDuration(workout.duration_min)} · {intensityLabel(workout.intensity)}</p>
                        </div>
                      </div>
                      {workout.objective ? <p className="mt-2 text-sm">{workout.objective}</p> : null}
                      {workout.why_text ? <p className="mt-2 text-sm text-muted">{workout.why_text}</p> : null}
                      {workout.exercises.length ? (
                        <ul className="mt-3 grid gap-2">
                          {workout.exercises.map((exercise) => (
                            <li key={`${exercise.name}-${exercise.reps}`} className="rounded-xl bg-paper px-3 py-2 text-sm">
                              <span className="font-bold">{exercise.name}</span> · {exercise.sets} × {exercise.reps}
                              {exercise.liveSlug && date === today ? (
                                <Link className="mt-1 block font-bold text-maroon" href={`/live/${exercise.liveSlug}?workout=${workout.id}`}>Open camera</Link>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link className="btn btn-primary" href={`/train/${workout.id}`}>Start</Link>
                        {date === today && workout.exercises.some((exercise) => exercise.liveSlug) ? (
                          <Link className="btn btn-ghost" href={`/live?workout=${workout.id}`}>Live camera</Link>
                        ) : null}
                      </div>
                      {workout.status === "completed" ? null : (
                        <label className="mt-3 text-sm">
                          Move to
                          <input
                            type="date"
                            value={workout.scheduled_date}
                            disabled={busyId === workout.id}
                            onChange={(event) => {
                              if (event.target.value) void relocate(workout.id, event.target.value);
                            }}
                          />
                        </label>
                      )}
                      <div className="mt-3">
                        <StatusChoices status={workout.status} busy={busyId === workout.id} onChoose={(next) => void choose(workout.id, next)} />
                      </div>
                    </article>
                  ))}
                </section>
              );
            })}
          </div>
        </div>
      ))}
      {ghost ? (
        <div
          className="pointer-events-none fixed z-50 rounded-2xl bg-maroon px-3 py-2 text-sm font-bold text-white shadow-lg"
          style={{ left: ghost.x + 16, top: ghost.y + 16 }}
        >
          {ghost.title}
        </div>
      ) : null}
    </div>
  );
}
