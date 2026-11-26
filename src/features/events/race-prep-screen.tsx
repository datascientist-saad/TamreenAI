"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  MapPin,
  AlertTriangle,
} from "lucide-react";
import { resolveEventPriorityConflict, saveRacePrepState } from "@/server/actions";
import {
  computeKitProgress,
  type ChecklistItem,
  type FuelSlot,
  type RacePrepSnapshot,
  type TimelineItem,
} from "@/services/events/race-prep";

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
  const [checklist, setChecklist] = useState(() => {
    if (!cached?.checklist?.length) return snapshot.checklist;
    const byId = new Map(cached.checklist.map((item) => [item.id, item]));
    return snapshot.checklist.map((item) => {
      const prev = byId.get(item.id);
      return prev ? { ...item, done: Boolean(prev.done), doneAt: prev.doneAt ?? null } : item;
    });
  });
  // Prefer server/snapshot times (wave changes) while keeping local done flags.
  const [timeline, setTimeline] = useState(() => {
    if (!cached?.timeline?.length) return snapshot.timeline;
    const byId = new Map(cached.timeline.map((item) => [item.id, item]));
    return snapshot.timeline.map((item) => {
      const prev = byId.get(item.id);
      return prev ? { ...item, done: Boolean(prev.done) } : item;
    });
  });
  const [fuel, setFuel] = useState(() => cached?.fuel?.length ? cached.fuel : snapshot.fuel);

  // When start/wave changes rebuild the snapshot timeline, adopt new times without wiping done.
  useEffect(() => {
    setTimeline((prev) => {
      const byId = new Map(prev.map((item) => [item.id, item]));
      return snapshot.timeline.map((item) => {
        const local = byId.get(item.id);
        return local ? { ...item, done: Boolean(local.done) } : item;
      });
    });
  }, [snapshot.timeline]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [offlinePending, setOfflinePending] = useState(() => Boolean(cached?.pending));
  const [revision, setRevision] = useState(() => cached?.offlineRevision ?? 0);
  const [justChecked, setJustChecked] = useState<string | null>(null);

  useEffect(() => {
    if (!offlinePending || typeof navigator === "undefined" || !navigator.onLine) return;
    void syncNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offlinePending]);

  useEffect(() => {
    if (!justChecked) return;
    const id = window.setTimeout(() => setJustChecked(null), 450);
    return () => window.clearTimeout(id);
  }, [justChecked]);

  const kit = useMemo(() => computeKitProgress(checklist), [checklist]);

  const nextTimeline = useMemo(
    () => timeline.find((item) => !item.done) ?? null,
    [timeline],
  );

  function persistLocal(next: { checklist: ChecklistItem[]; timeline: TimelineItem[]; fuel: FuelSlot[]; pending: boolean; offlineRevision: number }) {
    localStorage.setItem(OFFLINE_KEY(snapshot.eventId), JSON.stringify(next));
  }

  async function syncNow(nextChecklist = checklist, nextTimelineItems = timeline, nextFuel = fuel) {
    setError("");
    try {
      const result = await saveRacePrepState({
        eventId: snapshot.eventId,
        checklist: nextChecklist,
        raceDayPlan: { timeline: nextTimelineItems },
        fuelingPlan: { slots: nextFuel },
        offlineRevision: revision,
        clearOfflinePending: true,
      });
      if (!result.ok) {
        setOfflinePending(true);
        persistLocal({ checklist: nextChecklist, timeline: nextTimelineItems, fuel: nextFuel, pending: true, offlineRevision: revision });
        setError(result.message);
        return;
      }
      setRevision(result.offlineRevision);
      setOfflinePending(false);
      persistLocal({
        checklist: nextChecklist,
        timeline: nextTimelineItems,
        fuel: nextFuel,
        pending: false,
        offlineRevision: result.offlineRevision,
      });
      setMessage("Saved.");
      router.refresh();
    } catch {
      setOfflinePending(true);
      persistLocal({ checklist: nextChecklist, timeline: nextTimelineItems, fuel: nextFuel, pending: true, offlineRevision: revision });
      setError("Saved offline. Will sync when you are back online.");
    }
  }

  function toggleChecklist(id: string) {
    const next = checklist.map((item) =>
      item.id === id ? { ...item, done: !item.done, doneAt: !item.done ? new Date().toISOString() : null } : item,
    );
    const turningOn = next.find((item) => item.id === id)?.done;
    if (turningOn) setJustChecked(id);
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

  const tabs: Array<{ id: typeof section; label: string }> = [
    { id: "prepare", label: "Prepare" },
    { id: "fuel", label: "Fuel" },
    { id: "race_day", label: "Race Day" },
    { id: "recover", label: "Recover" },
  ];

  const startLine = snapshot.needsStartTime
    ? `${snapshot.eventDateLabel} · Add start time`
    : snapshot.startLabel;

  return (
    <main className="mx-auto grid w-full min-w-0 max-w-3xl gap-4 px-4 py-4 pb-24 sm:py-6">
      <header className="grid gap-3">
        <Link className="btn btn-ghost btn-sm w-fit" href={backHref}>
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden />
          {backLabel}
        </Link>
        <div>
          <h1 className="page-title">{snapshot.eventName}</h1>
          <p className="mt-1 text-sm text-muted">{startLine}</p>
          <p className="mt-1 text-sm font-semibold text-ink" aria-label={snapshot.countdownAnnounce}>
            {snapshot.countdownLabel}
          </p>
        </div>
        {offlinePending ? (
          <p className="flex items-start gap-2 rounded-[var(--radius-sm)] bg-warning-soft px-3 py-2 text-sm text-warning" role="status">
            <AlertTriangle size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
            Offline update pending. Changes sync when connectivity returns.
            <button type="button" className="btn btn-ghost btn-sm ml-auto" onClick={() => void syncNow()} disabled={pending}>
              Retry
            </button>
          </p>
        ) : null}
        {message ? <p className="sr-only" role="status">{message}</p> : null}
        {error ? <p className="text-sm text-live" role="alert">{error}</p> : null}
      </header>

      {overlaps.length ? (
        <section className="app-card grid gap-3 border-l-2 border-l-warning p-4">
          <h2 className="font-bold">Schedule conflicts</h2>
          {overlaps.map((item) => (
            <div key={item.title} className="grid gap-2 rounded-[var(--radius-sm)] bg-paper px-3 py-2 text-sm">
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

      <div className="flex gap-1 overflow-x-auto border-b border-line pb-0" role="tablist" aria-label="Race Prep sections">
        {tabs.map((tab) => {
          const active = section === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                active
                  ? "border-maroon text-maroon"
                  : "border-transparent text-muted hover:text-ink"
              }`}
              onClick={() => setSection(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {section === "prepare" ? (
        <section className="grid gap-4" role="tabpanel">
          <article className="grid gap-1">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="section-title">Race kit</h2>
              <p className="text-sm font-semibold text-ink">{kit.label}</p>
            </div>
            {kit.ready ? (
              <div className="mt-2 grid gap-3">
                <p className="text-sm text-muted">
                  Kit is packed. Meals and travel stay separate — confirm those under Fuel and Race Day.
                </p>
                <button
                  type="button"
                  className="btn btn-primary w-full sm:w-auto"
                  onClick={() => setSection("race_day")}
                >
                  View race morning timeline
                </button>
              </div>
            ) : null}
            <ul className="mt-2 divide-y divide-line border-y border-line">
              {[
                ...(!kit.ready && kit.next ? [kit.next] : []),
                ...kit.items.filter((item) => item.id !== kit.next?.id),
              ].map((item) => {
                const isNext = !kit.ready && kit.next?.id === item.id;
                const flash = justChecked === item.id;
                return (
                  <li key={item.id}>
                    <label
                      className={`flex min-h-12 cursor-pointer items-start gap-3 py-3 text-sm ${
                        flash ? "kit-check-flash" : ""
                      }`}
                    >
                      <span className="relative mt-0.5">
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() => toggleChecklist(item.id)}
                          aria-label={item.label}
                          className="accent-[var(--maroon)]"
                        />
                        {flash ? (
                          <Check
                            size={14}
                            strokeWidth={2.5}
                            className="pointer-events-none absolute -right-1 -top-1 text-maroon kit-check-mark"
                            aria-hidden
                          />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        {isNext ? <span className="mb-0.5 block text-xs font-semibold text-maroon">Up next</span> : null}
                        <span className={item.done ? "text-muted" : "font-semibold text-ink"}>
                          {item.label}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </article>

          <article className="grid gap-2">
            <h2 className="section-title">Event details</h2>
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

          <article className="grid gap-2">
            <h2 className="section-title">Schedule notes</h2>
            <ul className="grid gap-1 text-sm text-muted">
              {snapshot.scheduleNotes.map((note) => <li key={note}>{note}</li>)}
            </ul>
            <Link className="btn btn-ghost btn-sm w-fit" href={details.affectedWeekHref}>Open affected week</Link>
          </article>
        </section>
      ) : null}

      {section === "fuel" ? (
        <section className="grid gap-3" role="tabpanel">
          {fuel.map((slot) => (
            <article key={slot.id} className="app-card grid gap-3 p-4">
              <h2 className="font-bold">{slot.title}</h2>
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
          <article className="grid gap-3">
            <h2 className="section-title">Race day timeline</h2>
            <ol className="divide-y divide-line border-y border-line">
              {timeline.map((item) => {
                const active = nextTimeline?.id === item.id;
                return (
                  <li
                    key={item.id}
                    className={`flex items-start gap-3 py-3 ${active ? "bg-maroon-soft/40 -mx-2 px-2" : ""}`}
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
                            hour: "numeric",
                            minute: "2-digit",
                            hourCycle: "h12",
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
          <ChecklistBlock
            items={checklist.filter((item) => item.section === "race_day")}
            onToggle={toggleChecklist}
            justChecked={justChecked}
          />
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
          <article className="grid gap-2">
            <h2 className="section-title">After the finish</h2>
            <ul className="grid gap-1 text-sm text-muted">
              {(fuel.find((slot) => slot.id === "after")?.suggestions ?? []).map((line) => <li key={line}>{line}</li>)}
            </ul>
          </article>
          <ChecklistBlock
            items={checklist.filter((item) => item.section === "recover")}
            onToggle={toggleChecklist}
            justChecked={justChecked}
          />
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
  justChecked,
}: {
  items: ChecklistItem[];
  onToggle: (id: string) => void;
  justChecked?: string | null;
}) {
  if (!items.length) return null;
  return (
    <article className="grid gap-2">
      <h2 className="section-title">Checklist</h2>
      <ul className="divide-y divide-line border-y border-line">
        {items.map((item) => (
          <li key={item.id}>
            <label
              className={`flex min-h-12 cursor-pointer items-center gap-3 py-3 text-sm font-semibold ${
                justChecked === item.id ? "kit-check-flash" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => onToggle(item.id)}
                aria-label={item.label}
              />
              <span className={item.done ? "text-muted" : "text-ink"}>
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
