import { PageFrame } from "@/components/page";
import { addGymCamera, addGymEquipment, createGym } from "@/server/actions";
import { requireRole } from "@/server/guard";

export default async function GymPage() {
  const { supabase, user } = await requireRole("gym_admin");
  const { data: gyms } = await supabase.from("gyms").select("id, name, location").eq("owner_id", user.id).is("deleted_at", null);
  const ids = (gyms ?? []).map((gym) => gym.id);
  const [{ data: cameras }, { data: equipment }, { data: members }, { data: sessions }] = await Promise.all([
    ids.length ? supabase.from("gym_cameras").select("id, gym_id, name, status, identification_mode").in("gym_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("gym_equipment").select("id, gym_id, name, quantity, status").in("gym_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("gym_members").select("id, gym_id, role, consent_session_analysis").in("gym_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("gym_sessions").select("id, gym_id, checkin_method, started_at").in("gym_id", ids).order("started_at", { ascending: false }).limit(12) : Promise.resolve({ data: [] }),
  ]);
  return (
    <PageFrame eyebrow="Gym" title="Floor" lede="Athletes are linked by QR, an assigned session, a signed-in device, or a manual pick. Facial recognition is disabled in the database.">
      <form action={async (formData) => { "use server"; await createGym({ name: String(formData.get("name") || ""), location: String(formData.get("location") || "") }); }} className="app-card grid gap-3 p-4">
        <h2 className="font-bold">New gym</h2>
        <label>Name<input name="name" required /></label>
        <label>Location<input name="location" /></label>
        <button className="btn btn-primary" type="submit">Create</button>
      </form>
      {(gyms ?? []).map((gym) => (
        <section key={gym.id} className="grid gap-3">
          <h2 className="text-2xl font-bold">{gym.name}</h2>
          <p className="text-sm text-muted">{gym.location} · {(members ?? []).filter((member) => member.gym_id === gym.id).length} members · {(members ?? []).filter((member) => member.gym_id === gym.id && member.consent_session_analysis).length} consented to session analysis</p>
          <ul className="grid gap-2">
            {(cameras ?? []).filter((camera) => camera.gym_id === gym.id).map((camera) => (
              <li key={camera.id} className="app-card px-4 py-3 text-sm">{camera.name} · {camera.status} · {camera.identification_mode}</li>
            ))}
            {(equipment ?? []).filter((item) => item.gym_id === gym.id).map((item) => (
              <li key={item.id} className="text-sm">{item.name} × {item.quantity} · {item.status}</li>
            ))}
            {(sessions ?? []).filter((session) => session.gym_id === gym.id).map((session) => (
              <li key={session.id} className="text-sm text-muted">{session.checkin_method} · {session.started_at}</li>
            ))}
          </ul>
          <form action={async (formData) => { "use server"; await addGymCamera({ gymId: gym.id, name: String(formData.get("name") || ""), location: String(formData.get("location") || ""), mode: String(formData.get("mode") || "qr_checkin") as "qr_checkin" }); }} className="app-card grid gap-2 p-4">
            <h3 className="font-bold">Camera</h3>
            <input name="name" placeholder="Name" required />
            <input name="location" placeholder="Location" />
            <select name="mode" defaultValue="qr_checkin">
              <option value="qr_checkin">QR check-in</option>
              <option value="session_assignment">Session assignment</option>
              <option value="authenticated_device">Authenticated device</option>
              <option value="manual">Manual selection</option>
            </select>
            <button className="btn btn-ghost" type="submit">Add camera</button>
          </form>
          <form action={async (formData) => { "use server"; await addGymEquipment({ gymId: gym.id, name: String(formData.get("name") || ""), quantity: Number(formData.get("quantity") || 1) }); }} className="flex gap-2">
            <input name="name" placeholder="Equipment" required />
            <input name="quantity" inputMode="numeric" defaultValue="1" />
            <button className="btn btn-ghost" type="submit">Add</button>
          </form>
        </section>
      ))}
    </PageFrame>
  );
}
