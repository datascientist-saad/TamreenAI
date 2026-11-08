import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stravaServerConfig } from "@/services/wearables/strava-config";
import { createStravaState, stravaAuthorizeUrl, stravaRedirectUri } from "@/services/wearables/strava";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.redirect(new URL("/login?error=config", request.url));
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", "/api/strava/connect");
    return NextResponse.redirect(login);
  }
  const config = stravaServerConfig();
  if (!config) return NextResponse.redirect(new URL("/more?strava=missing-config", request.url));
  const state = createStravaState();
  const redirectUri = stravaRedirectUri(request.nextUrl.origin, config.redirectUri);
  const destination = stravaAuthorizeUrl({ clientId: config.clientId, redirectUri, state });
  const response = NextResponse.redirect(destination);
  response.cookies.set("strava_oauth", `${state}.${data.user.id}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/strava",
    maxAge: 600,
  });
  return response;
}
