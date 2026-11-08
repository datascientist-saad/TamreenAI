import "server-only";

export interface StravaServerConfig {
  clientId: string;
  clientSecret: string;
  tokenSecret: string;
  redirectUri?: string;
}

export function stravaServerConfig(): StravaServerConfig | null {
  const clientId = process.env.STRAVA_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.STRAVA_CLIENT_SECRET?.trim() ?? "";
  const tokenSecret = process.env.STRAVA_TOKEN_SECRET?.trim() ?? process.env.WHOOP_TOKEN_SECRET?.trim() ?? "";
  if (!clientId || !clientSecret || tokenSecret.length < 16) return null;
  const redirectUri = process.env.STRAVA_REDIRECT_URI?.trim();
  return {
    clientId,
    clientSecret,
    tokenSecret,
    redirectUri: redirectUri || undefined,
  };
}
