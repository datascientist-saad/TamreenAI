import Link from "next/link";
import { PageFrame } from "@/components/page";
import { PersonalEventForm } from "@/features/events/forms";
import { daysUntil, formatClock, todayInTimeZone } from "@/lib/utils";
import { requireUser } from "@/server/guard";

export default async function EventsPage() {
  const { supabase, user } = await requireUser();
  const { data: athlete } = await supabase.from("athlete_profiles").select("timezone").eq("user_id", user.id).maybeSingle();
  const today = todayInTimeZone(athlete?.timezone || "Asia/Qatar");
  const { data: events } = await supabase.from("events").select("id, name, event_type, starts_on, location, goal_time_seconds").eq("owner_user_id", user.id).is("deleted_at", null).order("starts_on");
  return (
    <PageFrame eyebrow="Events" title="What you are training for" lede="The plan's length and taper follow the next event date.">
      <ul className="grid gap-3">
        {(events ?? []).map((event) => (
          <li key={event.id}>
            <Link className="app-card block p-4" href={`/events/${event.id}`}>
              <p className="eyebrow">{event.event_type}</p>
              <h2 className="text-2xl font-bold">{event.name}</h2>
              <p className="metric">{daysUntil(event.starts_on, today)} days · {event.location ?? event.starts_on}{event.goal_time_seconds ? ` · goal ${formatClock(event.goal_time_seconds)}` : ""}</p>
            </Link>
          </li>
        ))}
      </ul>
      <PersonalEventForm />
    </PageFrame>
  );
}
