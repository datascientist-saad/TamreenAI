export const STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize";
export const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
export const STRAVA_API_BASE = "https://www.strava.com/api/v3";

export const STRAVA_SCOPES = "activity:write,activity:read_all";

const STATE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export interface StravaTokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
}

export interface StravaAthlete {
  id: number;
  firstname?: string;
  lastname?: string;
  profile?: string;
  city?: string;
  country?: string;
  sex?: string;
  premium?: boolean;
  created_at?: string;
  updated_at?: string;
  ftp?: number | null;
  weight?: number | null;
  clubs?: unknown[];
  bikes?: unknown[];
  shoes?: unknown[];
}

export interface StravaActivityStats {
  recent_run_totals?: { count: number; distance: number; moving_time: number; elapsed_time: number; elevation_gain: number };
  all_run_totals?: { count: number; distance: number; moving_time: number; elapsed_time: number; elevation_gain: number };
  ytd_run_totals?: { count: number; distance: number; moving_time: number; elapsed_time: number; elevation_gain: number };
  recent_ride_totals?: { count: number; distance: number; moving_time: number; elapsed_time: number; elevation_gain: number };
  all_ride_totals?: { count: number; distance: number; moving_time: number; elapsed_time: number; elevation_gain: number };
  ytd_ride_totals?: { count: number; distance: number; moving_time: number; elapsed_time: number; elevation_gain: number };
  recent_swim_totals?: { count: number; distance: number; moving_time: number; elapsed_time: number };
  all_swim_totals?: { count: number; distance: number; moving_time: number; elapsed_time: number };
  ytd_swim_totals?: { count: number; distance: number; moving_time: number; elapsed_time: number };
}

export interface StravaActivity {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  type: string;
  sport_type: string;
  start_date: string;
  start_date_local: string;
  timezone: string;
  average_speed: number;
  max_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_watts?: number;
  kilojoules?: number;
  description?: string;
}

export interface StravaCreateActivity {
  name: string;
  sport_type: string;
  start_date_local: string;
  elapsed_time: number;
  description?: string;
  distance?: number;
  trainer?: boolean;
  commute?: boolean;
}

export class StravaHttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "StravaHttpError";
    this.status = status;
  }
}

export function createStravaState(bytes = crypto.getRandomValues(new Uint8Array(8))): string {
  return Array.from(bytes, (value) => STATE_ALPHABET[value % STATE_ALPHABET.length]).join("");
}

export function stravaRedirectUri(origin: string, configured?: string): string {
  const override = configured?.trim();
  if (override) return override;
  return `${origin.replace(/\/$/, "")}/api/strava/callback`;
}

export function stravaAuthorizeUrl(input: { clientId: string; redirectUri: string; state: string }): string {
  const url = new URL(STRAVA_AUTH_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("scope", STRAVA_SCOPES);
  url.searchParams.set("state", input.state);
  url.searchParams.set("approval_prompt", "auto");
  return url.toString();
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
  scope?: string;
  athlete?: StravaAthlete;
  errors?: unknown;
  message?: string;
}

export async function requestStravaToken(
  body: Record<string, string>,
  fetchImpl: typeof fetch = fetch,
): Promise<{ token: StravaTokenSet; athlete?: StravaAthlete }> {
  const response = await fetchImpl(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new StravaHttpError(response.status, `Strava token request failed (${response.status}).`);
  }
  const payload = (await response.json()) as TokenResponse;
  if (!payload.access_token || !payload.refresh_token) {
    throw new StravaHttpError(502, "Strava token response was missing tokens.");
  }
  return {
    token: {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresAt: payload.expires_at ?? Math.floor(Date.now() / 1000) + (payload.expires_in ?? 21600),
      scope: payload.scope ?? "",
    },
    athlete: payload.athlete,
  };
}

async function stravaGet<T>(path: string, accessToken: string, fetchImpl: typeof fetch): Promise<T> {
  const url = new URL(`${STRAVA_API_BASE}${path}`);
  const response = await fetchImpl(url, {
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new StravaHttpError(response.status, `Strava ${path} failed (${response.status}).`);
  }
  return (await response.json()) as T;
}

export async function fetchStravaAthlete(accessToken: string, fetchImpl: typeof fetch = fetch): Promise<StravaAthlete> {
  const athlete = await stravaGet<StravaAthlete>("/athlete", accessToken, fetchImpl);
  if (!athlete.id) {
    throw new StravaHttpError(502, "Strava athlete did not include an id.");
  }
  return athlete;
}

export async function fetchStravaStats(athleteId: number, accessToken: string, fetchImpl: typeof fetch = fetch): Promise<StravaActivityStats> {
  return stravaGet<StravaActivityStats>(`/athletes/${athleteId}/stats`, accessToken, fetchImpl);
}

export async function fetchStravaActivities(accessToken: string, limit = 20, fetchImpl: typeof fetch = fetch): Promise<StravaActivity[]> {
  const url = new URL(`${STRAVA_API_BASE}/athlete/activities`);
  url.searchParams.set("per_page", String(limit));
  const response = await fetchImpl(url, {
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new StravaHttpError(response.status, `Strava activities failed (${response.status}).`);
  }
  return (await response.json()) as StravaActivity[];
}

export async function createStravaActivity(
  activity: StravaCreateActivity,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<StravaActivity> {
  const response = await fetchImpl(`${STRAVA_API_BASE}/activities`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(activity),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new StravaHttpError(response.status, `Strava create activity failed (${response.status}): ${text}`);
  }
  return (await response.json()) as StravaActivity;
}

export async function refreshStravaToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<StravaTokenSet> {
  const { token } = await requestStravaToken(
    {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    },
    fetchImpl,
  );
  return token;
}

export function stravaNotice(code: string | undefined): string | null {
  if (!code) return null;
  const messages: Record<string, string> = {
    connected: "Strava is connected. Your activities will sync and you can upload workouts.",
    disconnected: "Strava was disconnected.",
    "missing-config": "Strava integration is not configured on this server. Add STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET.",
    denied: "Strava authorization was declined.",
    state: "Strava authorization did not match this session. Try connecting again.",
    exchange: "Strava did not return a token. Try connecting again.",
    profile: "Strava did not return an athlete profile. Try connecting again.",
    uploaded: "Workout uploaded to Strava.",
    "upload-failed": "Could not upload workout to Strava. Make sure Strava is connected and try again.",
    "not-connected": "Connect Strava first to upload activities.",
  };
  return messages[code] ?? null;
}

/** Map a Tamreen sport slug to a Strava sport_type. */
export function tamreenSportToStrava(sport: string): string {
  const map: Record<string, string> = {
    running: "Run",
    cycling: "Ride",
    swimming: "Swim",
    triathlon: "Triathlon",
    strength: "WeightTraining",
    bodybuilding: "WeightTraining",
    crossfit: "Crossfit",
    yoga: "Yoga",
    pilates: "Pilates",
    hiit: "HIIT",
    rowing: "Rowing",
    tennis: "Tennis",
    basketball: "Basketball",
    football: "Football",
    soccer: "Soccer",
    volleyball: "Volleyball",
    boxing: "Boxing",
    martial_arts: "MartialArts",
    climbing: "RockClimbing",
    hiking: "Hike",
    walking: "Walk",
    skiing: "AlpineSki",
    snowboarding: "Snowboard",
    golf: "Golf",
    paddling: "Canoeing",
    surfing: "Surfing",
    crosscountry_skiing: "NordicSki",
    elliptical: "Elliptical",
    stair_stepper: "StairStepper",
    stretching: "Yoga",
  };
  return map[sport] ?? "Workout";
}
