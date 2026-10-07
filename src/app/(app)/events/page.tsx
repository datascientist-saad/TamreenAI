import Link from "next/link";
import { PageFrame } from "@/components/page";
import { daysUntil, todayInTimeZone } from "@/lib/utils";
import { createPersonalEvent } from "@/server/actions";
import { requireUser } from "@/server/guard";

export default async function EventsPage() {
  const { supabase, user } = await requireUser();
  const { data: athlete } = await supabase.from("athlete_profiles").select("timezone").eq("user_id", user.id).maybeSingle();
  const today = todayInTimeZone(athlete?.timezone || "Asia/Qatar");
  const { data: events } = await supabase.from("events").select("id, name, event_type, starts_on, location").eq("owner_user_id", user.id).is("deleted_at", null).order("starts_on");
  return (
    <PageFrame eyebrow="Events" title="What you are training for" lede="The plan's length and taper follow the next event date.">
      <ul className="grid gap-3">
        {(events ?? []).map((event) => (
          <li key={event.id}>
            <Link className="app-card block p-4" href={`/events/${event.id}`}>
              <p className="eyebrow">{event.event_type}</p>
              <h2 className="text-2xl font-bold">{event.name}</h2>
              <p className="metric">{daysUntil(event.starts_on, today)} days · {event.location ?? event.starts_on}</p>
            </Link>
          </li>
        ))}
      </ul>
      <form action={async (formData) => {
        "use server";
        await createPersonalEvent({
          name: String(formData.get("name") || ""),
          eventType: String(formData.get("eventType") || ""),
          date: String(formData.get("date") || ""),
          distanceM: formData.get("distanceM") ? Number(formData.get("distanceM")) : null,
          goalTimeSeconds: formData.get("goal") ? Number(formData.get("goal")) : null,
          location: String(formData.get("location") || ""),
        });
      }} className="app-card grid gap-3 p-4">
        <h2 className="font-bold">Add an event</h2>
        <label>Name<input name="name" required /></label>
        <label>Type<input name="eventType" placeholder="Ironman 70.3" required /></label>
        <label>Date<input name="date" type="date" required /></label>
        <label>Distance (m)<input name="distanceM" inputMode="decimal" /></label>
        <label>Goal time (seconds)<input name="goal" inputMode="numeric" /></label>
        <label>Location<input name="location" /></label>
        <button className="btn btn-primary" type="submit">Save event</button>
      </form>
    </PageFrame>
  );
}
