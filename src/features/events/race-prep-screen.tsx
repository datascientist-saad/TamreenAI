"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  MapPin,
  Timer,
  Utensils,
  Flag,
  HeartPulse,
  AlertTriangle,
} from "lucide-react";
import { resolveEventPriorityConflict, saveRacePrepState } from "@/server/actions";
import type { ChecklistItem, FuelSlot, RacePrepSnapshot, TimelineItem } from "@/services/events/race-prep";

const OFFLINE_KEY = (eventId: string) => `tamreen-race-prep:${eventId}`;

type Props = {
  snapshot: RacePrepSnapshot;
  backHref: string;
  backLabel: string;
  details: {
    distanceLabel: string;
    location: string | null;
    waveLabel: string | null;
    bibPickup: string | null;
    checkInLabel: string | null;
    travelMinutes: number | null;
    affectedWeekHref: string;
  };
  overlaps?: Array<{ title: string; detail: string; eventIds: string[] }>;
  hasResult: boolean;
};

function readOfflineCache(eventId: string): {
  checklist?: ChecklistItem[];
  timeline?: TimelineItem[];
  fuel?: FuelSlot[];
  offlineRevision?: number;
  pending?: boolean;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(OFFLINE_KEY(eventId));
    if (!raw) return null;
    return JSON.parse(raw) as {
      checklist?: ChecklistItem[];
      timeline?: TimelineItem[];
      fuel?: FuelSlot[];
      offlineRevision?: number;
      pending?: boolean;
    };
  } catch {
    return null;
  }
}

export function RacePrepScreen({ snapshot, backHref, backLabel, details, overlaps = [], hasResult }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const cached = useMemo(() => readOfflineCache(snapshot.eventId), [snapshot.eventId]);
  const [section, setSection] = useState(snapshot.section);
  const [checklist, setChecklist] = useState(() => cached?.checklist?.length ? cached.checklist : snapshot.checklist);
  const [timeline, setTimeline] = useState(() => cached?.timeline?.length ? cached.timeline : snapshot.timeline);
  const [fuel, setFuel] = useState(() => cached?.fuel?.length ? cached.fuel : snapshot.fuel);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [offlinePending, setOfflinePending] = useState(() => Boolean(cached?.pending));
  const [revision, setRevision] = useState(() => cached?.offlineRevision ?? 0);

  useEffect(() => {
    if (!offlinePending || typeof navigator === "undefined" || !navigator.onLine) return;
    void syncNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offlinePending]);

  const progress = useMemo(() => {
    const done = checklist.filter((item) => item.done).length;
    return { done, total: checklist.length, pct: checklist.length ? Math.round((done / checklist.length) * 100) : 0 };
  }, [checklist]);

  const nextAction = useMemo(() => {
    if (section === "race_day") {
      return timeline.find((item) => !item.done) ?? checklist.find((item) => !item.done && item.section === "race_day");
    }
    return checklist.find((item) => !item.done && item.section === section) ?? checklist.find((item) => !item.done);
  }, [checklist, section, timeline]);

  function persistLocal(next: { checklist: ChecklistItem[]; timeline: TimelineItem[]; fuel: FuelSlot[]; pending: boolean; offlineRevision: number }) {
    localStorage.setItem(OFFLINE_KEY(snapshot.eventId), JSON.stringify(next));
  }

  async function syncNow(nextChecklist = checklist, nextTimeline = timeline, nextFuel = fuel) {
    setError("");
    try {
      const result = await saveRacePrepState({
        eventId: snapshot.eventId,
        checklist: nextChecklist,
        raceDayPlan: { timeline: nextTimeline },
        fuelingPlan: { slots: nextFuel },
        offlineRevision: revision,
        clearOfflinePending: true,
      });
      if (!result.ok) {
        setOfflinePending(true);
        persistLocal({ checklist: nextChecklist, timeline: nextTimeline, fuel: nextFuel, pending: true, offlineRevision: revision });
        setError(result.message);
        return;
      }
      setRevision(result.offlineRevision);
      setOfflinePending(false);
      persistLocal({
        checklist: nextChecklist,
        timeline: nextTimeline,
        fuel: nextFuel,
        pending: false,
        offlineRevision: result.offlineRevision,
      });
      setMessage("Race Prep saved.");
      router.refresh();
    } catch {
      setOfflinePending(true);
      persistLocal({ checklist: nextChecklist, timeline: nextTimeline, fuel: nextFuel, pending: true, offlineRevision: revision });
      setError("Saved offline. Will sync when you are back online.");
    }
  }

  function toggleChecklist(id: string) {
    const next = checklist.map((item) =>
      item.id === id ? { ...item, done: !item.done, doneAt: !item.done ? new Date().toISOString() : null } : item,
    );
    setChecklist(next);
    startTransition(() => {
      void syncNow(next, timeline, fuel);
    });
  }

  function toggleTimeline(id: string) {
    const next = timeline.map((item) => (item.id === id ? { ...item, done: !item.done } : item));
    setTimeline(next);
    startTransition(() => {
      void syncNow(checklist, next, fuel);
    });
  }

  function updateFuel(id: FuelSlot["id"], patch: Partial<FuelSlot>) {
    const next = fuel.map((slot) => (slot.id === id ? { ...slot, ...patch } : slot));
    setFuel(next);
    startTransition(() => {
      void syncNow(checklist, timeline, next);
    });
  }

  const tabs: Array<{ id: typeof section; label: string; icon: typeof Flag }> = [
    { id: "prepare", label: "Prepare", icon: Flag },
    { id: "fuel", label: "Fuel", icon: Utensils },
    { id: "race_day", label: "Race Day", icon: Timer },
    { id: "recover", label: "Recover", icon: HeartPulse },
  ];

  return (
    <main className="mx-auto grid w-full min-w-0 max-w-3xl gap-4 px-4 py-4 pb-24 sm:py-6">
      <header className="grid gap-3">
        <Link className="btn btn-ghost btn-sm w-fit" href={backHref}>
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden />
          {backLabel}
        </Link>
        <div>
          <p className="eyebrow">{snapshot.cardTitle}</p>
          <h1 className="page-title mt-1">{snapshot.eventName}</h1>
          <p className="caption mt-1">
            {snapshot.countdownLabel}
            {snapshot.startLabel ? ` · ${snapshot.startLabel}` : " · Start time not set"}
            {snapshot.timeZoneLabel ? ` · ${snapshot.timeZoneLabel}` : ""}
          </p>
        </div>
        <div className="app-card grid gap-2 p-4">
          <p className="text-sm font-semibold">Next action</p>
          <p className="text-sm text-muted">{nextAction && "label" in nextAction ? nextAction.label : "All set for now"}</p>
          <div className="progress-bar" role="progressbar" aria-valuenow={progress.pct} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${progress.pct}%` }} />
          </div>
          <p className="caption">{progress.done}/{progress.total} checklist complete</p>
        </div>
        {offlinePending ? (
          <p className="flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning" role="status">
            <AlertTriangle size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
            Offline update pending. Changes sync when connectivity returns.
            <button type="button" className="btn btn-ghost btn-sm ml-auto" onClick={() => void syncNow()} disabled={pending}>
              Retry
            </button>
          </p>
        ) : null}
        {message ? <p className="text-sm font-semibold text-maroon" role="status">{message}</p> : null}
        {error ? <p className="text-sm text-live" role="alert">{error}</p> : null}
      </header>

      {overlaps.length ? (
        <section className="app-card grid gap-3 border-l-2 border-l-warning p-4">
          <h2 className="font-bold">Schedule conflicts</h2>
          {overlaps.map((item) => (
            <div key={item.title} className="grid gap-2 rounded-xl bg-paper px-3 py-2 text-sm">
              <p>
                <span className="font-semibold">{item.title}.</span> {item.detail}
              </p>
              {item.eventIds.length === 2 ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-soft btn-sm"
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        const result = await resolveEventPriorityConflict({
                          primaryEventId: item.eventIds[0],
                          secondaryEventId: item.eventIds[1],
                        });
                        if (!result.ok) {
                          setError(result.message);
                          return;
                        }
                        setMessage("Priority updated. Both events stay visible.");
                        router.refresh();
                      });
                    }}
                  >
                    Prefer first event
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        const result = await resolveEventPriorityConflict({
                          primaryEventId: item.eventIds[1],
                          secondaryEventId: item.eventIds[0],
                        });
                        if (!result.ok) {
                          setError(result.message);
                          return;
                        }
                        setMessage("Priority updated. Both events stay visible.");
                        router.refresh();
                      });
                    }}
                  >
                    Prefer second event
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Race Prep sections">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = section === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`btn btn-sm shrink-0 ${active ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setSection(tab.id)}
            >
              <Icon size={14} strokeWidth={1.75} aria-hidden />
              {tab.label}
            </button>
          );
        })}
      </div>

      {section === "prepare" ? (
        <section className="grid gap-3" role="tabpanel">
          <article className="app-card grid gap-2 p-4">
            <h2 className="font-bold">Event details</h2>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-muted">Distance</dt><dd className="font-semibold">{details.distanceLabel}</dd></div>
              <div><dt className="text-muted">Location</dt><dd className="font-semibold">{details.location || "—"}</dd></div>
              <div><dt className="text-muted">Start</dt><dd className="font-semibold">{snapshot.startLabel || "Add start time"}</dd></div>
              <div><dt className="text-muted">Wave</dt><dd className="font-semibold">{details.waveLabel || "—"}</dd></div>
              <div><dt className="text-muted">Bib pickup</dt><dd className="font-semibold">{details.bibPickup || "—"}</dd></div>
              <div><dt className="text-muted">Check-in</dt><dd className="font-semibold">{details.checkInLabel || "—"}</dd></div>
              <div><dt className="text-muted">Travel</dt><dd className="font-semibold">{details.travelMinutes != null ? `${details.travelMinutes} min` : "—"}</dd></div>
            </dl>
            {snapshot.needsStartTime ? (
              <Link className="btn btn-soft btn-sm w-fit" href={`/events/${snapshot.eventId}`}>Add start time</Link>
            ) : null}
          </article>
          <article className="app-card grid gap-2 p-4">
            <h2 className="font-bold">Schedule changes</h2>
            <ul className="grid gap-1 text-sm text-muted">
              {snapshot.scheduleNotes.map((note) => <li key={note}>{note}</li>)}
            </ul>
            <Link className="btn btn-ghost btn-sm w-fit" href={details.affectedWeekHref}>Open affected week</Link>
          </article>
          <ChecklistBlock items={checklist.filter((item) => item.section === "prepare" || item.section === "fuel")} onToggle={toggleChecklist} />
        </section>
      ) : null}

      {section === "fuel" ? (
        <section className="grid gap-3" role="tabpanel">
          {fuel.map((slot) => (
            <article key={slot.id} className="app-card grid gap-3 p-4">
              <h2 className="flex items-center gap-2 font-bold">
                <Utensils size={16} strokeWidth={1.75} className="text-maroon" aria-hidden />
                {slot.title}
              </h2>
              <ul className="grid gap-1 text-sm text-muted">
                {slot.suggestions.map((line) => <li key={line}>{line}</li>)}
              </ul>
              <label>
                Preferred / planned
                <input
                  value={slot.preferred ?? ""}
                  onChange={(event) => updateFuel(slot.id, { preferred: event.target.value })}
                  placeholder="e.g. Oatmeal + banana"
                />
              </label>
              {slot.id === "during" ? (
                <>
                  <label>
                    What to carry
                    <input
                      value={slot.carry ?? ""}
                      onChange={(event) => updateFuel(slot.id, { carry: event.target.value })}
                      placeholder="Gels, flask, salt…"
                    />
                  </label>
                  <label>
                    Aid stations
                    <textarea
                      value={slot.aidStations ?? ""}
                      onChange={(event) => updateFuel(slot.id, { aidStations: event.target.value })}
                      placeholder="Known stations or course notes"
                    />
                  </label>
                </>
              ) : null}
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={(slot.tried ?? []).includes(slot.preferred || "marked")}
                  onChange={(event) => {
                    const key = slot.preferred || "marked";
                    const tried = new Set(slot.tried ?? []);
                    if (event.target.checked) tried.add(key);
                    else tried.delete(key);
                    updateFuel(slot.id, { tried: [...tried] });
                  }}
                />
                Mark as tried in training
              </label>
            </article>
          ))}
          <p className="caption">Guidance follows your nutrition preferences. No invented course or target numbers when inputs are missing.</p>
        </section>
      ) : null}

      {section === "race_day" ? (
        <section className="grid gap-3" role="tabpanel">
          <article className="app-card grid gap-3 p-4">
            <h2 className="font-bold">Race day timeline</h2>
            <ol className="grid gap-2">
              {timeline.map((item) => {
                const active = nextAction && "id" in nextAction && nextAction.id === item.id;
                return (
                  <li
                    key={item.id}
                    className={`flex items-start gap-3 rounded-xl px-3 py-2 ${active ? "bg-maroon-soft ring-1 ring-maroon" : "bg-paper"}`}
                  >
                    <button
                      type="button"
                      className={`mt-0.5 grid h-6 w-6 place-items-center rounded-full border ${item.done ? "border-maroon bg-maroon text-white" : "border-line"}`}
                      aria-pressed={item.done}
                      aria-label={`Mark ${item.label} ${item.done ? "incomplete" : "done"}`}
                      onClick={() => toggleTimeline(item.id)}
                    >
                      {item.done ? <Check size={14} strokeWidth={2} aria-hidden /> : null}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{item.label}</p>
                      <p className="caption">
                        {item.at
                          ? new Date(item.at).toLocaleString("en-GB", {
                            weekday: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                            hourCycle: "h23",
                            timeZone: snapshot.timeZoneLabel || undefined,
                          })
                          : "Time TBD"}
                      </p>
                      {item.conflict ? <p className="text-xs text-warning">{item.conflict}</p> : null}
                      {item.action && active ? (
                        <button type="button" className="btn btn-soft btn-sm mt-2" onClick={() => toggleTimeline(item.id)}>
                          {item.action}
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </article>
          <ChecklistBlock items={checklist.filter((item) => item.section === "race_day")} onToggle={toggleChecklist} />
          {details.location ? (
            <a
              className="btn btn-ghost"
              href={`https://maps.google.com/?q=${encodeURIComponent(details.location)}`}
              target="_blank"
              rel="noreferrer"
            >
              <MapPin size={16} strokeWidth={1.75} aria-hidden />
              Open directions
            </a>
          ) : null}
        </section>
      ) : null}

      {section === "recover" ? (
        <section className="grid gap-3" role="tabpanel">
          <article className="app-card grid gap-2 p-4">
            <h2 className="font-bold">After the finish</h2>
            <ul className="grid gap-1 text-sm text-muted">
              {(fuel.find((slot) => slot.id === "after")?.suggestions ?? []).map((line) => <li key={line}>{line}</li>)}
            </ul>
          </article>
          <ChecklistBlock items={checklist.filter((item) => item.section === "recover")} onToggle={toggleChecklist} />
          <div className="flex flex-wrap gap-2">
            <Link className="btn btn-primary" href={`/events/${snapshot.eventId}`}>
              {hasResult ? "View result" : "Log race result"}
            </Link>
            <Link className="btn btn-ghost" href="/recovery?tab=checkin">Recovery check-in</Link>
            <Link className="btn btn-ghost" href="/plan">Return-to-training plan</Link>
          </div>
        </section>
      ) : null}
    </main>
  );
}

function ChecklistBlock({
  items,
  onToggle,
}: {
  items: ChecklistItem[];
  onToggle: (id: string) => void;
}) {
  if (!items.length) return null;
  return (
    <article className="app-card grid gap-2 p-4">
      <h2 className="font-bold">Checklist</h2>
      <ul className="grid gap-2">
        {items.map((item) => (
          <li key={item.id}>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-paper px-3 py-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => onToggle(item.id)}
                aria-label={item.label}
              />
              <span className={item.done ? "text-muted line-through" : ""}>
                {item.label}
                {item.optional ? <span className="caption"> · optional</span> : null}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </article>
  );
}
