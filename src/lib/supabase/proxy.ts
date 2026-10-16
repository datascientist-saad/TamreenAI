import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "./env";

const PROTECTED = [
  "/home",
  "/plan",
  "/calendar",
  "/live",
  "/progress",
  "/train",
  "/log",
  "/run",
  "/triathlon",
  "/recovery",
  "/ai",
  "/records",
  "/analytics",
  "/events",
  "/settings",
  "/notifications",
  "/more",
  "/conflicts",
  "/coach",
  "/gym",
  "/event-admin",
  "/admin",
  "/onboarding",
];

export async function updateSession(request: NextRequest) {
  const env = supabaseEnv();
  if (!env) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  if (!data.user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  const onboardingPath = path === "/onboarding" || path.startsWith("/onboarding/");
  if (data.user && isProtected && !onboardingPath) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", data.user.id)
      .maybeSingle();
    if (!error && profile?.onboarding_completed !== true) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      url.search = "";
      const redirectResponse = NextResponse.redirect(url);
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie);
      });
      return redirectResponse;
    }
  }
  return response;
}
