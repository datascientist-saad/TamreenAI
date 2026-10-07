import { PageFrame } from "@/components/page";
import { createEventOrganization, createManagedEvent, recordEventResult } from "@/server/actions";
import { requireRole } from "@/server/guard";

export default async function EventAdminPage() {
  const { supabase, user } = await requireRole("event_admin");
  const { data: orgs } = await supabase.from("event_organizations").select("id, name").eq("owner_id", user.id).is("deleted_at", null);
  const ids = (orgs ?? []).map((org) => org.id);
  const { data: events } = ids.length
    ? await supabase.from("events").select("id, name, starts_on, organization_id").in("organization_id", ids).is("deleted_at", null)
    : { data: [] };
  const eventIds = (events ?? []).map((event) => event.id);
  const { data: registrations } = eventIds.length
    ? await supabase.from("event_registrations").select("id, event_id, user_id, status").in("event_id", eventIds)
    : { data: [] };
  return (
    <PageFrame eyebrow="Events" title="Organizer desk" lede="Results use the finish time and splits you enter. Technique is not inferred from a camera.">
      <form action={async (formData) => { "use server"; await createEventOrganization(String(formData.get("name") || "")); }} className="app-card grid gap-2 p-4">
        <label>Organization<input name="name" required /></label>
        <button className="btn btn-primary" type="submit">Create organization</button>
      </form>
      {(orgs ?? []).map((org) => (
        <section key={org.id} className="grid gap-3">
          <h2 className="text-2xl font-bold">{org.name}</h2>
          <form action={async (formData) => {
            "use server";
            await createManagedEvent({
              organizationId: org.id,
              name: String(formData.get("name") || ""),
              eventType: String(formData.get("eventType") || ""),
              date: String(formData.get("date") || ""),
              location: String(formData.get("location") || ""),
              distanceM: formData.get("distanceM") ? Number(formData.get("distanceM")) : null,
            });
          }} className="app-card grid gap-2 p-4">
            <input name="name" placeholder="Event name" required />
            <input name="eventType" placeholder="10K" required />
            <input name="date" type="date" required />
            <input name="location" placeholder="Location" />
            <input name="distanceM" placeholder="Distance metres" />
            <button className="btn btn-ghost" type="submit">Publish event</button>
          </form>
          {(events ?? []).filter((event) => event.organization_id === org.id).map((event) => (
            <article key={event.id} className="app-card p-4">
              <h3 className="font-bold">{event.name}</h3>
              <p className="text-sm text-muted">{event.starts_on} · {(registrations ?? []).filter((row) => row.event_id === event.id).length} registrations</p>
              <form action={async (formData) => {
                "use server";
                await recordEventResult({
                  eventId: event.id,
                  athleteId: String(formData.get("athleteId") || ""),
                  finishSeconds: Number(formData.get("finish") || 0),
                  splits: String(formData.get("splits") || "").split(",").map((part) => Number(part.trim())).filter((part) => part > 0),
                });
              }} className="mt-3 grid gap-2">
                <input name="athleteId" placeholder="Athlete id" required />
                <input name="finish" placeholder="Finish time seconds" required />
                <input name="splits" placeholder="Km splits in seconds, comma separated" />
                <button className="btn btn-primary" type="submit">Save result</button>
              </form>
            </article>
          ))}
        </section>
      ))}
    </PageFrame>
  );
}
