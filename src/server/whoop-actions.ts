"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { whoopServerConfig } from "@/services/wearables/whoop-config";
import { disconnectWhoopAccount, syncWhoopAccount } from "@/services/wearables/whoop-sync";
import { requireUser } from "./guard";

function refreshPages() {
  revalidatePath("/home");
  revalidatePath("/recovery");
  revalidatePath("/more");
  revalidatePath("/analytics");
  revalidatePath("/settings");
}

export async function syncWhoopAction() {
  const { supabase, user } = await requireUser();
  const config = whoopServerConfig();
  if (!config) redirect("/more?whoop=missing-config");
  const result = await syncWhoopAccount(supabase, user.id, config);
  refreshPages();
  redirect(result.ok ? "/recovery?whoop=synced" : `/more?whoop=${result.code}`);
}

export async function disconnectWhoopAction() {
  const { supabase, user } = await requireUser();
  const result = await disconnectWhoopAccount(supabase, user.id, whoopServerConfig());
  refreshPages();
  redirect(`/more?whoop=${result.code}`);
}
