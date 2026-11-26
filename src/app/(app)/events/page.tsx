import Link from "next/link";
import { Suspense } from "react";
import { Trophy } from "lucide-react";
import { PageFrame } from "@/components/page";
import { ScrollRestore } from "@/components/scroll-restore";
import { EmptyState } from "@/components/ui/empty-state";
import { PersonalEventForm } from "@/features/events/forms";
import { formatDistanceKm } from "@/services/events/catalog";
import { withReturnTo } from "@/lib/navigation";
import { daysUntil, formatClock, todayInTimeZone } from "@/lib/utils";
import { requireUser } from "@/server/guard";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; weekLink?: string }>;
}) {
  const { notice, weekLink } = await searchParams;
  const { supabase, user } = await requireUser();
  const { data: athlete } = await supabase.from("athlete_profiles").select("timezone").eq("user_id", user.id).maybeSingle();
  const today = todayInTimeZone(athlete?.timezone || "Asia/Qatar");
  const { data: events } = await supabase
    .from("events")
    .select("id, name, event_type, starts_on, location, goal_time_seconds, priority, status, distance_m, swim_m, bike_m, run_m")
    .eq("owner_user_id", user.id)
    .is("deleted_at", null)
    .order("starts_on");
  const active = (events ?? []).filter((event) => (event.status ?? "active") !== "cancelled");
  const returnTo = "/plan?tab=events";
  return (
    <PageFrame
      eyebrow="Plan"
      title="Events"
      lede="Keep multiple races active. One integrated plan supports them by priority."
      compact
      actions={
        <div className="flex flex-wrap gap-2">
          <Link className="btn btn-ghost btn-sm" href="/plan">Schedule</Link>
          <a className="btn btn-primary btn-sm" href="#add-event">Add event</a>
        </div>
      }
    >
      <Suspense fallback={null}>
        <ScrollRestore />
      </Suspense>
      {notice ? (
        <p className="rounded-[var(--radius-md)] border border-line bg-elevated px-3 py-2 text-sm" role="status">
          {notice}
          {weekLink ? (
            <>
              {" "}
              <Link className="font-bold text-maroon" href={weekLink}>Open affected week</Link>
            </>
          ) : null}
        </p>
      ) : null}

      {active.length ? (
        <ul className="grid gap-3">
          {active.map((event) => (
            <li key={event.id}>
              <div className="app-card grid gap-3 p-4 transition hover:border-maroon/40">
                <Link className="block" href={withReturnTo(`/events/${event.id}`, returnTo)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="eyebrow">{event.priority ?? "primary"} · {event.event_type}</p>
                      <h2 className="text-2xl font-bold break-words">{event.name}</h2>
                      <p className="metric mt-1">
                        {daysUntil(event.starts_on, today)} days · {event.location ?? event.starts_on}
                        {event.goal_time_seconds ? ` · goal ${formatClock(event.goal_time_seconds)}` : ""}
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        {event.swim_m || event.bike_m || event.run_m
                          ? `Swim ${formatDistanceKm(event.swim_m)} · Bike ${formatDistanceKm(event.bike_m)} · Run ${formatDistanceKm(event.run_m)}`
                          : formatDistanceKm(event.distance_m)}
                      </p>
                    </div>
                    <Trophy size={18} strokeWidth={1.75} className="mt-1 shrink-0 text-maroon" aria-hidden />
                  </div>
                </Link>
                {event.starts_on >= today ? (
                  <Link
                    className="btn btn-soft btn-sm w-fit"
                    href={`/events/${event.id}/prep?from=${encodeURIComponent("/events")}`}
                  >
                    Open Race Prep
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No events yet"
          body="Add your next race so Tamreen can place taper, race day, and recovery."
          href="#add-event"
          action="Add an event"
          icon={Trophy}
        />
      )}

      <div id="add-event" className="scroll-mt-24">
        <PersonalEventForm />
      </div>
    </PageFrame>
  );
}
