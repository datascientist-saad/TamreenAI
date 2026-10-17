export const WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
export const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
export const WHOOP_API_BASE = "https://api.prod.whoop.com/developer";

export const WHOOP_SCOPES = [
  "read:recovery",
  "read:cycles",
  "read:sleep",
  "read:profile",
  "offline",
].join(" ");

const STATE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export type WhoopScoreState = "SCORED" | "PENDING_SCORE" | "UNSCORABLE" | string;

export interface WhoopCycle {
  id: number;
  user_id?: number;
  start: string;
  end?: string | null;
  timezone_offset?: string | null;
  score_state?: WhoopScoreState | null;
  score?: {
    strain?: number | null;
    kilojoule?: number | null;
    average_heart_rate?: number | null;
    max_heart_rate?: number | null;
  } | null;
}

export interface WhoopRecovery {
  cycle_id: number;
  sleep_id?: string | null;
  score_state?: WhoopScoreState | null;
  score?: {
    user_calibrating?: boolean | null;
    recovery_score?: number | null;
    resting_heart_rate?: number | null;
    hrv_rmssd_milli?: number | null;
    spo2_percentage?: number | null;
    skin_temp_celsius?: number | null;
  } | null;
}

export interface WhoopSleep {
  id?: string;
  cycle_id: number;
  start?: string | null;
  end?: string | null;
  nap?: boolean | null;
  score_state?: WhoopScoreState | null;
  score?: {
    stage_summary?: {
      total_in_bed_time_milli?: number | null;
      total_light_sleep_time_milli?: number | null;
      total_slow_wave_sleep_time_milli?: number | null;
      total_rem_sleep_time_milli?: number | null;
    } | null;
    respiratory_rate?: number | null;
    sleep_performance_percentage?: number | null;
    sleep_consistency_percentage?: number | null;
    sleep_efficiency_percentage?: number | null;
  } | null;
}

export interface WhoopProfile {
  user_id: number;
  email?: string;
  first_name?: string;
  last_name?: string;
}

export interface WhoopTokenSet {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
}

export interface WhoopMetricDraft {
  cycleId: number;
  day: string;
  cycleStart: string;
  cycleEnd: string | null;
  timezoneOffset: string;
  recoveryScore: number | null;
  restingHeartRate: number | null;
  hrvRmssdMilli: number | null;
  spo2Percentage: number | null;
  skinTempCelsius: number | null;
  userCalibrating: boolean;
  recoveryState: string | null;
  strain: number | null;
  kilojoule: number | null;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  strainState: string | null;
  sleepPerformancePercentage: number | null;
  sleepEfficiencyPercentage: number | null;
  sleepConsistencyPercentage: number | null;
  respiratoryRate: number | null;
  asleepMilli: number | null;
  inBedMilli: number | null;
  sleepStart: string | null;
  sleepEnd: string | null;
  sleepState: string | null;
  sleepIsNap: boolean;
}

export interface WhoopMetricView {
  cycleId: number;
  day: string;
  recoveryScore: number | null;
  restingHeartRate: number | null;
  hrvRmssdMilli: number | null;
  spo2Percentage: number | null;
  skinTempCelsius: number | null;
  userCalibrating: boolean;
  recoveryState: string | null;
  strain: number | null;
  kilojoule: number | null;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  strainState: string | null;
  sleepPerformancePercentage: number | null;
  sleepEfficiencyPercentage: number | null;
  sleepConsistencyPercentage: number | null;
  respiratoryRate: number | null;
  asleepMilli: number | null;
  inBedMilli: number | null;
  sleepState: string | null;
  sleepIsNap: boolean;
}

export class WhoopHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "WhoopHttpError";
    this.status = status;
  }
}

export function createWhoopState(bytes = crypto.getRandomValues(new Uint8Array(8))): string {
  return Array.from(bytes, (value) => STATE_ALPHABET[value % STATE_ALPHABET.length]).join("");
}

export function whoopRedirectUri(origin: string, configured?: string): string {
  const override = configured?.trim();
  if (override) return override;
  return `${origin.replace(/\/$/, "")}/api/whoop/callback`;
}

export function whoopAuthorizeUrl(input: { clientId: string; redirectUri: string; state: string }): string {
  if (input.state.length !== 8) {
    throw new Error("WHOOP requires an 8 character state value.");
  }
  const url = new URL(WHOOP_AUTH_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("scope", WHOOP_SCOPES);
  url.searchParams.set("state", input.state);
  return url.toString();
}

export function localDay(iso: string, offset: string | null | undefined): string {
  const instant = Date.parse(iso);
  if (Number.isNaN(instant)) return iso.slice(0, 10);
  const zone = offset?.trim() || "Z";
  if (zone === "Z") return new Date(instant).toISOString().slice(0, 10);
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(zone);
  if (!match) return new Date(instant).toISOString().slice(0, 10);
  const minutes = (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]));
  return new Date(instant + minutes * 60_000).toISOString().slice(0, 10);
}

export function bounded(value: number | null | undefined, min: number, max: number): number | null {
  if (value == null || Number.isNaN(Number(value))) return null;
  const number = Number(value);
  if (number < min || number > max) return null;
  return number;
}

export function asleepMilli(sleep: WhoopSleep): number | null {
  if (sleep.score_state !== "SCORED") return null;
  const stage = sleep.score?.stage_summary;
  if (!stage) return null;
  const light = stage.total_light_sleep_time_milli ?? 0;
  const slowWave = stage.total_slow_wave_sleep_time_milli ?? 0;
  const rem = stage.total_rem_sleep_time_milli ?? 0;
  const total = light + slowWave + rem;
  return total > 0 ? total : null;
}

function pickMainSleep(sleeps: WhoopSleep[]): WhoopSleep | null {
  const nights = sleeps.filter((sleep) => sleep.nap !== true);
  if (!nights.length) return null;
  return nights.slice().sort((left, right) => (asleepMilli(right) ?? 0) - (asleepMilli(left) ?? 0))[0] ?? null;
}

export function mergeWhoopDays(input: {
  cycles: WhoopCycle[];
  recoveries: WhoopRecovery[];
  sleeps: WhoopSleep[];
}): WhoopMetricDraft[] {
  const recoveries = new Map(input.recoveries.map((recovery) => [recovery.cycle_id, recovery]));
  const sleeps = new Map<number, WhoopSleep[]>();
  for (const sleep of input.sleeps) {
    const list = sleeps.get(sleep.cycle_id) ?? [];
    list.push(sleep);
    sleeps.set(sleep.cycle_id, list);
  }

  return input.cycles.map((cycle) => {
    const recovery = recoveries.get(cycle.id);
    const sleep = pickMainSleep(sleeps.get(cycle.id) ?? []);
    const cycleScore = cycle.score_state === "SCORED" ? cycle.score : null;
    const recoveryScore = recovery?.score_state === "SCORED" ? recovery.score : null;
    const sleepScore = sleep?.score_state === "SCORED" ? sleep.score : null;
    const offset = cycle.timezone_offset?.trim() || "Z";
    return {
      cycleId: cycle.id,
      day: localDay(cycle.start, offset),
      cycleStart: cycle.start,
      cycleEnd: cycle.end ?? null,
      timezoneOffset: offset,
      recoveryScore: bounded(recoveryScore?.recovery_score, 0, 100),
      restingHeartRate: bounded(recoveryScore?.resting_heart_rate, 20, 250),
      hrvRmssdMilli: bounded(recoveryScore?.hrv_rmssd_milli, 0, 1000),
      spo2Percentage: bounded(recoveryScore?.spo2_percentage, 0, 100),
      skinTempCelsius: bounded(recoveryScore?.skin_temp_celsius, 10, 50),
      userCalibrating: Boolean(recoveryScore?.user_calibrating),
      recoveryState: recovery?.score_state ?? null,
      strain: bounded(cycleScore?.strain, 0, 21),
      kilojoule: cycleScore?.kilojoule != null && cycleScore.kilojoule >= 0 ? cycleScore.kilojoule : null,
      averageHeartRate: bounded(cycleScore?.average_heart_rate, 20, 250),
      maxHeartRate: bounded(cycleScore?.max_heart_rate, 20, 250),
      strainState: cycle.score_state ?? null,
      sleepPerformancePercentage: bounded(sleepScore?.sleep_performance_percentage, 0, 100),
      sleepEfficiencyPercentage: bounded(sleepScore?.sleep_efficiency_percentage, 0, 100),
      sleepConsistencyPercentage: bounded(sleepScore?.sleep_consistency_percentage, 0, 100),
      respiratoryRate: bounded(sleepScore?.respiratory_rate, 0, 60),
      asleepMilli: sleep ? asleepMilli(sleep) : null,
      inBedMilli: sleepScore?.stage_summary?.total_in_bed_time_milli ?? null,
      sleepStart: sleep?.start ?? null,
      sleepEnd: sleep?.end ?? null,
      sleepState: sleep?.score_state ?? null,
      sleepIsNap: false,
    };
  });
}

export function sleepHoursFromMilli(milliseconds: number | null): number | null {
  if (milliseconds == null || milliseconds <= 0) return null;
  return Math.round((milliseconds / 3_600_000) * 10) / 10;
}

export function formatPercent(value: number | null): string {
  if (value == null) return "—";
  return `${Math.round(value)}%`;
}

export function formatStrain(value: number | null): string {
  if (value == null) return "—";
  return value.toFixed(1);
}

export function formatMilliHours(milliseconds: number | null): string {
  const hours = sleepHoursFromMilli(milliseconds);
  if (hours == null) return "—";
  return `${hours.toFixed(1)} h`;
}

export function formatOptionalNumber(value: number | null, digits = 0, suffix = ""): string {
  if (value == null) return "—";
  const text = digits === 0 ? String(Math.round(value)) : value.toFixed(digits);
  return `${text}${suffix}`;
}

export function whoopNotice(code: string | undefined): string | null {
  if (!code) return null;
  const messages: Record<string, string> = {
    connected: "WHOOP is connected. Recovery, strain, and sleep from the last 30 days are in Tamreen.",
    synced: "WHOOP metrics are up to date.",
    disconnected: "WHOOP is disconnected. Metrics already saved stay in Tamreen.",
    "revoked-local": "WHOOP was removed from Tamreen. If it still lists the app, disconnect Tamreen in WHOOP as well.",
    "missing-config": "WHOOP is not configured on this server yet. Add the client id, client secret, and token secret, then register the callback URL.",
    denied: "WHOOP authorization was declined. Nothing was imported.",
    state: "That WHOOP authorization did not match this sign-in. Start the connection again.",
    exchange: "WHOOP did not return a token. Start the connection again.",
    profile: "WHOOP did not return a profile, so Tamreen did not mark the device as connected.",
    sync: "WHOOP is linked, but the latest metrics could not be loaded. Sync again in a moment.",
    "rate-limit": "WHOOP asked Tamreen to wait before another sync.",
    expired: "The WHOOP session expired. Connect again to refresh metrics.",
  };
  return messages[code] ?? null;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

export async function requestWhoopToken(
  body: Record<string, string>,
  fetchImpl: typeof fetch = fetch,
): Promise<WhoopTokenSet> {
  const response = await fetchImpl(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new WhoopHttpError(response.status, `WHOOP token request failed (${response.status}).`);
  }
  const payload = (await response.json()) as TokenResponse;
  if (!payload.access_token || !payload.refresh_token || !payload.expires_in) {
    throw new WhoopHttpError(502, "WHOOP token response was missing a token.");
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: payload.expires_in,
    scope: payload.scope ?? "",
  };
}

async function whoopGet<T>(path: string, accessToken: string, fetchImpl: typeof fetch, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${WHOOP_API_BASE}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) url.searchParams.set(key, value);
  }
  const response = await fetchImpl(url, {
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new WhoopHttpError(response.status, `WHOOP ${path} failed (${response.status}).`);
  }
  return (await response.json()) as T;
}

async function listWhoop<T>(path: string, accessToken: string, start: string, fetchImpl: typeof fetch): Promise<T[]> {
  const records: T[] = [];
  let nextToken = "";
  for (let page = 0; page < 4; page += 1) {
    const body = await whoopGet<{ records?: T[]; next_token?: string | null }>(path, accessToken, fetchImpl, {
      limit: "25",
      start,
      nextToken,
    });
    records.push(...(body.records ?? []));
    nextToken = body.next_token ?? "";
    if (!nextToken) break;
  }
  return records;
}

export async function fetchWhoopProfile(accessToken: string, fetchImpl: typeof fetch = fetch): Promise<WhoopProfile> {
  const profile = await whoopGet<WhoopProfile>("/v2/user/profile/basic", accessToken, fetchImpl);
  if (!profile.user_id) {
    throw new WhoopHttpError(502, "WHOOP profile did not include a user id.");
  }
  return profile;
}

export async function pullWhoopMetrics(accessToken: string, startIso: string, fetchImpl: typeof fetch = fetch): Promise<WhoopMetricDraft[]> {
  const [cycles, recoveries, sleeps] = await Promise.all([
    listWhoop<WhoopCycle>("/v2/cycle", accessToken, startIso, fetchImpl),
    listWhoop<WhoopRecovery>("/v2/recovery", accessToken, startIso, fetchImpl),
    listWhoop<WhoopSleep>("/v2/activity/sleep", accessToken, startIso, fetchImpl),
  ]);
  return mergeWhoopDays({ cycles, recoveries, sleeps });
}

export async function revokeWhoopAccess(accessToken: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const response = await fetchImpl(`${WHOOP_API_BASE}/v2/user/access`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  return response.ok || response.status === 204;
}
