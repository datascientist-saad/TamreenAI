"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronDown, RefreshCw, Target } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProposedChange = {
  id: string;
  title: string;
  fromDate: string;
  toDate: string;
  fromIntensity?: string | null;
  toIntensity?: string | null;
  fromDurationMin?: number | null;
  toDurationMin?: number | null;
  reason: string;
  impact?: string | null;
  eventGoals?: string[];
  detail?: string | null;
};

export function ProposedChangesPanel({
  proposalId,
  explanation,
  changes,
  violations = [],
  onAcceptAll,
  onRejectAll,
  onAcceptOne,
  onRejectOne,
}: {
  proposalId: string;
  explanation: string;
  changes: ProposedChange[];
  violations?: Array<{ kind?: string; detail: string }>;
  onAcceptAll: (proposalId: string) => Promise<void>;
  onRejectAll: (proposalId: string) => Promise<void>;
  onAcceptOne?: (proposalId: string, changeId: string) => Promise<void>;
  onRejectOne?: (proposalId: string, changeId: string) => Promise<void>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"accept" | "reject" | string | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState<"accepted" | "rejected" | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  async function run(kind: "accept" | "reject" | string, action: () => Promise<void>, result: "accepted" | "rejected" | null = null) {
    if (pending) return;
    setPending(kind);
    setError("");
    try {
      await action();
      if (result) setDone(result);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The change could not be saved.");
    } finally {
      setPending(null);
    }
  }

  if (done) {
    return (
      <div className="rounded-[var(--radius-md)] border border-line bg-elevated p-4 text-sm" role="status" aria-live="polite">
        {done === "accepted" ? "Changes applied." : "Proposal cancelled. Original schedule kept."}
      </div>
    );
  }

  return (
    <div className="grid gap-3" aria-live="polite">
      <div className="flex items-start gap-2">
        <RefreshCw size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-maroon" aria-hidden />
        <div className="min-w-0">
          <p className="section-title">Proposed changes</p>
          <p className="mt-1 text-sm text-muted line-clamp-2">{explanation}</p>
        </div>
      </div>

      {violations.length > 0 ? (
        <ul className="grid gap-1 text-xs text-muted">
          {violations.map((item, index) => (
            <li key={`${item.detail}-${index}`} className="rounded-[var(--radius-sm)] bg-warning-soft px-2 py-1">{item.detail}</li>
          ))}
        </ul>
      ) : null}

      <ul className="grid gap-2">
        {changes.map((change) => {
          const open = Boolean(expanded[change.id]);
          return (
            <li key={change.id} className="app-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold leading-snug">{change.title}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium">
                    <span className="inline-flex items-center gap-1 text-maroon">
                      <CalendarDays size={14} strokeWidth={1.75} aria-hidden />
                      {change.fromDate} → {change.toDate}
                    </span>
                    {change.fromDurationMin != null || change.toDurationMin != null ? (
                      <span className="metric text-muted">
                        {change.fromDurationMin ?? "—"}→{change.toDurationMin ?? "—"} min
                      </span>
                    ) : null}
                    {change.fromIntensity || change.toIntensity ? (
                      <span className="text-muted">
                        {change.fromIntensity ?? "—"} → {change.toIntensity ?? "—"}
                      </span>
                    ) : null}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm shrink-0"
                  aria-expanded={open}
                  onClick={() => setExpanded((prev) => ({ ...prev, [change.id]: !open }))}
                >
                  Details
                  <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} aria-hidden />
                </button>
              </div>

              {open ? (
                <div className="mt-2 grid gap-1.5 border-t border-line pt-2 text-sm text-muted">
                  <p>{change.reason}</p>
                  {change.impact ? <p>Impact: {change.impact}</p> : null}
                  {change.eventGoals?.length ? (
                    <p className="flex flex-wrap items-center gap-1 caption">
                      <Target size={12} strokeWidth={1.75} aria-hidden />
                      {change.eventGoals.join(" · ")}
                    </p>
                  ) : null}
                  {change.detail ? <p>{change.detail}</p> : null}
                </div>
              ) : null}

              {onAcceptOne || onRejectOne ? (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {onAcceptOne ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={Boolean(pending)}
                      aria-busy={pending === `accept-${change.id}`}
                      onClick={() => void run(`accept-${change.id}`, () => onAcceptOne(proposalId, change.id))}
                    >
                      {pending === `accept-${change.id}` ? "Saving…" : "Accept"}
                    </button>
                  ) : null}
                  {onRejectOne ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={Boolean(pending)}
                      aria-busy={pending === `reject-${change.id}`}
                      onClick={() => void run(`reject-${change.id}`, () => onRejectOne(proposalId, change.id))}
                    >
                      Reject
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="grid gap-2 sm:flex sm:flex-wrap">
        <button
          type="button"
          className="btn btn-primary w-full sm:w-auto"
          disabled={Boolean(pending)}
          aria-busy={pending === "accept"}
          onClick={() => void run("accept", () => onAcceptAll(proposalId), "accepted")}
        >
          {pending === "accept" ? "Applying…" : "Accept all compatible"}
        </button>
        <button
          type="button"
          className="btn btn-ghost w-full sm:w-auto"
          disabled={Boolean(pending)}
          aria-busy={pending === "reject"}
          onClick={() => void run("reject", () => onRejectAll(proposalId), "rejected")}
        >
          {pending === "reject" ? "Cancelling…" : "Reject all"}
        </button>
      </div>
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
    </div>
  );
}
