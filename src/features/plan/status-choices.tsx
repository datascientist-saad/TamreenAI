"use client";

import { statusLabel } from "./model";

export function StatusChoices({
  status,
  busy,
  onChoose,
}: {
  status: string;
  busy?: boolean;
  onChoose: (next: "skipped" | "missed" | "planned") => void;
}) {
  if (status === "completed") {
    return <p className="text-sm font-bold text-muted">Done. This session stays on the day it was completed.</p>;
  }
  return (
    <div className="grid gap-2">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Status · {statusLabel(status)}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={busy}
          aria-pressed={status === "skipped"}
          className={`rounded-2xl border px-3 py-3 text-left ${status === "skipped" ? "border-gold bg-gold/25" : "border-line bg-paper"}`}
          onClick={() => onChoose(status === "skipped" ? "planned" : "skipped")}
        >
          <span className="block font-extrabold">Skip</span>
          <span className="mt-1 block text-sm text-muted">You are choosing not to do this session. Tap again to put it back.</span>
        </button>
        <button
          type="button"
          disabled={busy}
          aria-pressed={status === "missed"}
          className={`rounded-2xl border px-3 py-3 text-left ${status === "missed" ? "border-live bg-live/15" : "border-line bg-paper"}`}
          onClick={() => onChoose(status === "missed" ? "planned" : "missed")}
        >
          <span className="block font-extrabold">Missed</span>
          <span className="mt-1 block text-sm text-muted">The session passed and was not done. Tap again to put it back.</span>
        </button>
      </div>
    </div>
  );
}
