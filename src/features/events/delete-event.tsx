"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";
import { deletePersonalEvent, retryEventReplan } from "@/server/actions";
import { buildPlanHref } from "@/lib/navigation";

export function EventActionsMenu({
  eventId,
  eventName,
  eventDate,
  returnTo,
  isPrimary = false,
}: {
  eventId: string;
  eventName: string;
  eventDate: string;
  returnTo?: string | null;
  isPrimary?: boolean;
}) {
  const router = useRouter();
  const menuId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [replanFailed, setReplanFailed] = useState(false);
  const [result, setResult] = useState<{ message: string; weekHref?: string | null } | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>("button, [href], input")?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      previouslyFocused?.focus?.();
    };
  }, [open]);

  async function confirmDelete() {
    if (pending) return;
    setPending(true);
    setError("");
    setReplanFailed(false);
    try {
      const response = await deletePersonalEvent({ id: eventId });
      if (!response.ok) {
        setError(response.message);
        setPending(false);
        return;
      }
      if (response.replanOk === false) {
        setReplanFailed(true);
        setResult({
          message: response.message || "Event deleted, but the plan could not be recalculated.",
          weekHref: response.weekHref,
        });
        setPending(false);
        return;
      }
      setOpen(false);
      const dest = returnTo || "/events";
      const notice = encodeURIComponent(response.message || "Event deleted.");
      const join = dest.includes("?") ? "&" : "?";
      router.push(`${dest}${join}notice=${notice}${response.weekHref ? `&weekLink=${encodeURIComponent(response.weekHref)}` : ""}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The event was not deleted.");
      setPending(false);
    }
  }

  async function retryReplan() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const response = await retryEventReplan({ eventId, trigger: "event_cancel" });
      if (!response.ok) {
        setError(response.message);
        setPending(false);
        return;
      }
      setReplanFailed(false);
      setOpen(false);
      router.push(returnTo || "/events");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Plan recalculation failed.");
      setPending(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="btn btn-ghost btn-sm min-h-11 min-w-11"
        aria-haspopup="menu"
        aria-expanded={false}
        aria-controls={menuId}
        aria-label={`Actions for ${eventName}`}
        onClick={() => {
          const menu = document.getElementById(menuId);
          if (menu) menu.hidden = !menu.hidden;
        }}
      >
        <MoreVertical size={16} strokeWidth={1.75} aria-hidden />
      </button>
      <div
        id={menuId}
        role="menu"
        hidden
        className="absolute right-0 z-40 mt-1 min-w-44 rounded-[var(--radius-md)] border border-line bg-card p-1 shadow-lg"
      >
        <a role="menuitem" className="block rounded-[var(--radius-sm)] px-3 py-2.5 text-sm font-semibold hover:bg-elevated" href="#edit-event">
          Edit event
        </a>
        <button
          type="button"
          role="menuitem"
          className="block w-full rounded-[var(--radius-sm)] px-3 py-2.5 text-left text-sm font-semibold text-danger hover:bg-elevated"
          onClick={() => {
            const menu = document.getElementById(menuId);
            if (menu) menu.hidden = true;
            setOpen(true);
          }}
        >
          Delete event…
        </button>
      </div>

      <dialog
        ref={dialogRef}
        className="w-[min(100%,24rem)] max-w-[calc(100vw-2rem)] rounded-[var(--radius-lg)] border border-line bg-card p-0 text-ink shadow-xl backdrop:bg-ink/40"
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <div className="grid gap-3 p-4">
          <h2 className="text-lg font-bold">Delete event?</h2>
          <p className="text-sm text-muted">
            <span className="font-semibold text-ink">{eventName}</span>
            {" · "}
            {eventDate}
          </p>
          <p className="text-sm text-muted">
            This removes the event from your plan. Future taper, race-day, and recovery sessions around it will be recalculated.
            Completed workouts stay in your history.
            {isPrimary ? " This is currently your primary goal event — after deletion Tamreen will base the plan on any remaining events." : ""}
          </p>
          {result ? (
            <p className="rounded-[var(--radius-sm)] bg-elevated px-3 py-2 text-sm" role="status">
              {result.message}
              {result.weekHref ? (
                <>
                  {" "}
                  <a className="font-bold text-maroon" href={result.weekHref}>Open affected week</a>
                </>
              ) : null}
            </p>
          ) : null}
          {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            {replanFailed ? (
              <button type="button" className="btn btn-primary" disabled={pending} aria-busy={pending} onClick={() => void retryReplan()}>
                {pending ? "Retrying…" : "Retry plan update"}
              </button>
            ) : (
              <button type="button" className="btn btn-primary bg-danger hover:opacity-90" disabled={pending} aria-busy={pending} onClick={() => void confirmDelete()}>
                {pending ? "Deleting…" : "Delete event"}
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              disabled={pending && !replanFailed}
              onClick={() => {
                if (pending && !replanFailed) return;
                setOpen(false);
                if (replanFailed) {
                  router.push(returnTo || buildPlanHref({ tab: "events" }));
                  router.refresh();
                }
              }}
            >
              {replanFailed ? "Close" : "Cancel"}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
