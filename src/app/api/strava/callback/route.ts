import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stravaServerConfig } from "@/services/wearables/strava-config";
import { fetchStravaAthlete, requestStravaToken, stravaRedirectUri } from "@/services/wearables/strava";
import { storeStravaAuthorization } from "@/services/wearables/strava-sync";

function finish(request: NextRequest, code: string) {
  const response = NextResponse.redirect(new URL(`/more?strava=${encodeURIComponent(code)}`, request.url));
  response.cookies.set("strava_oauth", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/strava",
    maxAge: 0,
  });
  return response;
}

function readOauthCookie(value: string | undefined): { state: string; userId: string } | null {
  if (!value || value.length < 45 || value[8] !== ".") return null;
  const state = value.slice(0, 8);
  const userId = value.slice(9);
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return null;
  return { state, userId };
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  if (!supabase) return finish(request, "missing-config");
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", "/more");
    return NextResponse.redirect(login);
  }
  const config = stravaServerConfig();
  if (!config) return finish(request, "missing-config");
  if (request.nextUrl.searchParams.get("error")) return finish(request, "denied");

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookie = readOauthCookie(request.cookies.get("strava_oauth")?.value);
  if (!code || !state || !cookie || cookie.state !== state || cookie.userId !== data.user.id) {
    return finish(request, "state");
  }

  const redirectUri = stravaRedirectUri(request.nextUrl.origin, config.redirectUri);
  let token;
  let athlete;
  try {
    const result = await requestStravaToken({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });
    token = result.token;
    athlete = result.athlete;
  } catch {
    return finish(request, "exchange");
  }

  try {
    if (!athlete) {
      athlete = await fetchStravaAthlete(token.accessToken);
    }
    if (!athlete?.id) return finish(request, "profile");
    await storeStravaAuthorization(supabase, data.user.id, token, athlete, config);
  } catch {
    return finish(request, "profile");
  }

  return finish(request, "connected");
}
