import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  let next = url.searchParams.get("next") ?? "/home";
  if (code) {
    const supabase = await createClient();
    if (supabase) {
      await supabase.auth.exchangeCodeForSession(code);
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        const { data: profile } = await supabase.from("profiles").select("onboarding_completed").eq("id", data.user.id).maybeSingle();
        if (profile && !profile.onboarding_completed) next = "/onboarding";
        else if (profile?.onboarding_completed && next === "/onboarding") next = "/home";
      }
    }
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
