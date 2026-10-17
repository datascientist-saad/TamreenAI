import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { whoopServerConfig } from "@/services/wearables/whoop-config";
import { fetchWhoopProfile, requestWhoopToken, whoopRedirectUri } from "@/services/wearables/whoop";
import { storeWhoopAuthorization, syncWhoopAccount } from "@/services/wearables/whoop-sync";

function finish(request: NextRequest, code: string) {
  const response = NextResponse.redirect(new URL(`/recovery?whoop=${encodeURIComponent(code)}`, request.url));
  response.cookies.set("whoop_oauth", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/whoop",
    maxAge: 0,
  });
  return response;
}

function readOauthCookie(value: string | undefined): { state: string; userId: string } | null {
  if (!value || value.length < 46 || value[8] !== ".") return null;
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
  const config = whoopServerConfig();
  if (!config) return finish(request, "missing-config");
  if (request.nextUrl.searchParams.get("error")) return finish(request, "denied");

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookie = readOauthCookie(request.cookies.get("whoop_oauth")?.value);
  if (!code || !state || !cookie || cookie.state !== state || cookie.userId !== data.user.id) {
    return finish(request, "state");
  }

  const redirectUri = whoopRedirectUri(request.nextUrl.origin, config.redirectUri);
  let token;
  try {
    token = await requestWhoopToken({
      grant_type: "authorization_code",
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
    });
  } catch {
    return finish(request, "exchange");
  }
  try {
    const profile = await fetchWhoopProfile(token.accessToken);
    await storeWhoopAuthorization(supabase, data.user.id, token, String(profile.user_id), config);
  } catch {
    return finish(request, "profile");
  }

  const synced = await syncWhoopAccount(supabase, data.user.id, config);
  return finish(request, synced.ok ? "connected" : synced.code);
}
