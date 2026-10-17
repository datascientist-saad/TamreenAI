import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptWhoopSecret, encryptWhoopSecret } from "./whoop-crypto";
import {
  fetchWhoopProfile,
  pullWhoopMetrics,
  requestWhoopToken,
  revokeWhoopAccess,
  WhoopHttpError,
  WHOOP_SCOPES,
  type WhoopMetricDraft,
  type WhoopTokenSet,
} from "./whoop";

export interface WhoopServerConfig {
  clientId: string;
  clientSecret: string;
  tokenSecret: string;
  redirectUri?: string;
}

export type WhoopActionResult = { ok: true; code: string; count: number } | { ok: false; code: string };

type CredentialRow = {
  access_token_ciphertext: string;
  refresh_token_ciphertext: string;
  token_expires_at: string;
  scopes: string | null;
};

type ConnectionRow = {
  status: string;
  external_athlete_id: string | null;
  connected_at: string | null;
  last_sync_at: string | null;
};

function expiresAt(seconds: number, now: Date): string {
  return new Date(now.getTime() + seconds * 1000).toISOString();
}

function tokenIsFresh(expiry: string, now: Date): boolean {
  const at = Date.parse(expiry);
  return Number.isFinite(at) && at - now.getTime() > 60_000;
}

function metricRow(userId: string, metric: WhoopMetricDraft, syncedAt: string) {
  return {
    user_id: userId,
    cycle_id: metric.cycleId,
    day: metric.day,
    cycle_start: metric.cycleStart,
    cycle_end: metric.cycleEnd,
    timezone_offset: metric.timezoneOffset,
    recovery_score: metric.recoveryScore,
    resting_heart_rate: metric.restingHeartRate,
    hrv_rmssd_milli: metric.hrvRmssdMilli,
    spo2_percentage: metric.spo2Percentage,
    skin_temp_celsius: metric.skinTempCelsius,
    user_calibrating: metric.userCalibrating,
    recovery_state: metric.recoveryState,
    strain: metric.strain,
    kilojoule: metric.kilojoule,
    average_heart_rate: metric.averageHeartRate,
    max_heart_rate: metric.maxHeartRate,
    strain_state: metric.strainState,
    sleep_performance_percentage: metric.sleepPerformancePercentage,
    sleep_efficiency_percentage: metric.sleepEfficiencyPercentage,
    sleep_consistency_percentage: metric.sleepConsistencyPercentage,
    respiratory_rate: metric.respiratoryRate,
    asleep_milli: metric.asleepMilli,
    in_bed_milli: metric.inBedMilli,
    sleep_start: metric.sleepStart,
    sleep_end: metric.sleepEnd,
    sleep_state: metric.sleepState,
    sleep_is_nap: metric.sleepIsNap,
    synced_at: syncedAt,
  };
}

async function readCredentials(supabase: SupabaseClient, userId: string): Promise<CredentialRow | null> {
  const { data, error } = await supabase
    .from("whoop_credentials")
    .select("access_token_ciphertext, refresh_token_ciphertext, token_expires_at, scopes")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as CredentialRow | null;
}

async function readConnection(supabase: SupabaseClient, userId: string): Promise<ConnectionRow | null> {
  const { data, error } = await supabase
    .from("wearable_connections")
    .select("status, external_athlete_id, connected_at, last_sync_at")
    .eq("user_id", userId)
    .eq("provider", "whoop")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as ConnectionRow | null;
}

async function saveCredentials(supabase: SupabaseClient, userId: string, token: WhoopTokenSet, secret: string, now: Date) {
  const { error } = await supabase.from("whoop_credentials").upsert({
    user_id: userId,
    access_token_ciphertext: encryptWhoopSecret(token.accessToken, secret),
    refresh_token_ciphertext: encryptWhoopSecret(token.refreshToken, secret),
    token_expires_at: expiresAt(token.expiresIn, now),
    scopes: token.scope,
    updated_at: now.toISOString(),
  }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

async function saveConnection(
  supabase: SupabaseClient,
  userId: string,
  fields: {
    status: "connected" | "error" | "disconnected";
    externalAthleteId: string | null;
    connectedAt: string | null;
    lastSyncAt: string | null;
  },
) {
  const { error } = await supabase.from("wearable_connections").upsert({
    user_id: userId,
    provider: "whoop",
    status: fields.status,
    external_athlete_id: fields.externalAthleteId,
    connected_at: fields.connectedAt,
    last_sync_at: fields.lastSyncAt,
  }, { onConflict: "user_id,provider" });
  if (error) throw new Error(error.message);
}

async function refreshAccess(
  config: WhoopServerConfig,
  refreshToken: string,
  scope: string,
  fetchImpl: typeof fetch,
): Promise<WhoopTokenSet> {
  return requestWhoopToken({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: scope || WHOOP_SCOPES,
  }, fetchImpl);
}

async function markError(supabase: SupabaseClient, userId: string) {
  const existing = await readConnection(supabase, userId);
  await saveConnection(supabase, userId, {
    status: "error",
    externalAthleteId: existing?.external_athlete_id ?? null,
    connectedAt: existing?.connected_at ?? null,
    lastSyncAt: existing?.last_sync_at ?? null,
  });
}

export async function storeWhoopAuthorization(
  supabase: SupabaseClient,
  userId: string,
  token: WhoopTokenSet,
  athleteId: string,
  config: WhoopServerConfig,
  now = new Date(),
) {
  const existing = await readConnection(supabase, userId);
  await saveCredentials(supabase, userId, token, config.tokenSecret, now);
  await saveConnection(supabase, userId, {
    status: "connected",
    externalAthleteId: athleteId,
    connectedAt: existing?.connected_at ?? now.toISOString(),
    lastSyncAt: existing?.last_sync_at ?? null,
  });
}

export async function syncWhoopAccount(
  supabase: SupabaseClient,
  userId: string,
  config: WhoopServerConfig,
  options: { fetchImpl?: typeof fetch; now?: Date } = {},
): Promise<WhoopActionResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? new Date();
  const credentials = await readCredentials(supabase, userId);
  if (!credentials) return { ok: false, code: "disconnected" };

  let accessToken: string;
  let refreshToken: string;
  try {
    accessToken = decryptWhoopSecret(credentials.access_token_ciphertext, config.tokenSecret);
    refreshToken = decryptWhoopSecret(credentials.refresh_token_ciphertext, config.tokenSecret);
  } catch {
    const existing = await readConnection(supabase, userId);
    await saveConnection(supabase, userId, {
      status: "error",
      externalAthleteId: existing?.external_athlete_id ?? null,
      connectedAt: existing?.connected_at ?? null,
      lastSyncAt: existing?.last_sync_at ?? null,
    });
    return { ok: false, code: "expired" };
  }

  const scope = credentials.scopes || WHOOP_SCOPES;
  const rotate = async () => {
    const token = await refreshAccess(config, refreshToken, scope, fetchImpl);
    refreshToken = token.refreshToken;
    accessToken = token.accessToken;
    await saveCredentials(supabase, userId, token, config.tokenSecret, now);
  };

  try {
    if (!tokenIsFresh(credentials.token_expires_at, now)) await rotate();
  } catch (error) {
    if (error instanceof WhoopHttpError && error.status === 429) return { ok: false, code: "rate-limit" };
    await markError(supabase, userId);
    return { ok: false, code: "expired" };
  }

  const load = async () => {
    const profile = await fetchWhoopProfile(accessToken, fetchImpl);
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const metrics = await pullWhoopMetrics(accessToken, start, fetchImpl);
    return { profile, metrics };
  };

  let loaded: { profile: { user_id: number }; metrics: WhoopMetricDraft[] } | null = null;
  try {
    loaded = await load();
  } catch (error) {
    if (error instanceof WhoopHttpError && error.status === 401) {
      try {
        await rotate();
        loaded = await load();
      } catch (retryError) {
        if (retryError instanceof WhoopHttpError && retryError.status === 429) return { ok: false, code: "rate-limit" };
        await markError(supabase, userId);
        return { ok: false, code: "expired" };
      }
    } else if (error instanceof WhoopHttpError && error.status === 429) {
      return { ok: false, code: "rate-limit" };
    } else {
      await markError(supabase, userId);
      return { ok: false, code: "sync" };
    }
  }

  if (!loaded?.profile.user_id) return { ok: false, code: "profile" };
  const athleteId = String(loaded.profile.user_id);
  if (loaded.metrics.length) {
    const { error } = await supabase
      .from("whoop_metrics")
      .upsert(loaded.metrics.map((metric) => metricRow(userId, metric, now.toISOString())), { onConflict: "user_id,cycle_id" });
    if (error) return { ok: false, code: "sync" };
  }
  const existing = await readConnection(supabase, userId);
  await saveConnection(supabase, userId, {
    status: "connected",
    externalAthleteId: athleteId,
    connectedAt: existing?.connected_at ?? now.toISOString(),
    lastSyncAt: now.toISOString(),
  });
  return { ok: true, code: "synced", count: loaded.metrics.length };
}

export async function disconnectWhoopAccount(
  supabase: SupabaseClient,
  userId: string,
  config: WhoopServerConfig | null,
  fetchImpl: typeof fetch = fetch,
): Promise<WhoopActionResult> {
  const credentials = await readCredentials(supabase, userId);
  let revoked = !credentials;
  if (credentials && config) {
    try {
      const accessToken = decryptWhoopSecret(credentials.access_token_ciphertext, config.tokenSecret);
      const refreshToken = decryptWhoopSecret(credentials.refresh_token_ciphertext, config.tokenSecret);
      revoked = await revokeWhoopAccess(accessToken, fetchImpl);
      if (!revoked) {
        const token = await refreshAccess(config, refreshToken, credentials.scopes || WHOOP_SCOPES, fetchImpl);
        revoked = await revokeWhoopAccess(token.accessToken, fetchImpl);
      }
    } catch {
      revoked = false;
    }
  }
  const { error: deleteError } = await supabase.from("whoop_credentials").delete().eq("user_id", userId);
  if (deleteError) return { ok: false, code: "sync" };
  const { error } = await supabase.from("wearable_connections").update({
    status: "disconnected",
    external_athlete_id: null,
  }).eq("user_id", userId).eq("provider", "whoop");
  if (error) return { ok: false, code: "sync" };
  return { ok: true, code: revoked ? "disconnected" : "revoked-local", count: 0 };
}
