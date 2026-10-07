import { PageFrame } from "@/components/page";
import { markNotificationsRead } from "@/server/actions";
import { requireUser } from "@/server/guard";

export default async function NotificationsPage() {
  const { supabase, user } = await requireUser();
  const { data: notes } = await supabase.from("notifications").select("id, kind, title, body, href, read_at, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(40);
  return (
    <PageFrame eyebrow="Notifications" title="What changed">
      <form action={async () => { "use server"; await markNotificationsRead(); }}><button className="btn btn-ghost" type="submit">Mark all read</button></form>
      <ul className="grid gap-2">
        {(notes ?? []).map((note) => (
          <li key={note.id} className="app-card p-4">
            <p className="text-xs uppercase text-muted">{note.kind}{note.read_at ? "" : " · new"}</p>
            <h2 className="font-bold">{note.title}</h2>
            <p className="text-sm">{note.body}</p>
            {note.href ? <a className="text-sm font-bold" href={note.href}>Open</a> : null}
          </li>
        ))}
        {(notes ?? []).length === 0 ? <li className="text-muted">No notifications yet.</li> : null}
      </ul>
    </PageFrame>
  );
}
