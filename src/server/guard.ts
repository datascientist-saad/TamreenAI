import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const getAuth = cache(async () => {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, user: null };
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { supabase, user: null };
  return { supabase, user: data.user };
});

export async function requireUser() {
  const { supabase, user } = await getAuth();
  if (!supabase) redirect("/login?error=config");
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function requireRole(role: "coach" | "gym_admin" | "event_admin" | "super_admin") {
  const session = await requireUser();
  const { data } = await session.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id)
    .is("revoked_at", null);
  const roles = (data ?? []).map((row) => row.role as string);
  if (!roles.includes(role) && !roles.includes("super_admin")) redirect("/home");
  return { ...session, roles };
}
