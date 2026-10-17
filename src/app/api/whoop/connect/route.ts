import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { whoopServerConfig } from "@/services/wearables/whoop-config";
import { createWhoopState, whoopAuthorizeUrl, whoopRedirectUri } from "@/services/wearables/whoop";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.redirect(new URL("/login?error=config", request.url));
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", "/api/whoop/connect");
    return NextResponse.redirect(login);
  }
  const config = whoopServerConfig();
  if (!config) return NextResponse.redirect(new URL("/more?whoop=missing-config", request.url));
  const state = createWhoopState();
  const redirectUri = whoopRedirectUri(request.nextUrl.origin, config.redirectUri);
  const destination = whoopAuthorizeUrl({ clientId: config.clientId, redirectUri, state });
  const response = NextResponse.redirect(destination);
  response.cookies.set("whoop_oauth", `${state}.${data.user.id}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/whoop",
    maxAge: 600,
  });
  return response;
}
