import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { encryptStravaSecret, decryptStravaSecret } from "./strava-crypto";
import {
  refreshStravaToken,
  StravaHttpError,
  type StravaTokenSet,
  type StravaAthlete,
  type StravaCreateActivity,
  createStravaActivity,
} from "./strava";
import type { StravaServerConfig } from "./strava-config";

export type StravaActionResult = { ok: true; code: string } | { ok: false; code: string };

type CredentialRow = {
  access_token_ciphertext: string;
  refresh_token_ciphertext: string;
  token_expires_at: number;
  scopes: string | null;
};

function tokenIsFresh(expiresAt: number, now: Date): boolean {
  return expiresAt * 1000 - now.getTime() > 60_000;
}

async function readCredentials(supabase: SupabaseClient, userId: string): Promise<CredentialRow | null> {
  const { data } = await supabase
    .from("strava_credentials")
    .select("access_token_ciphertext, refresh_token_ciphertext, token_expires_at, scopes")
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? null;
}

async function freshAccessToken(
  supabase: SupabaseClient,
  userId: string,
  credentials: CredentialRow,
  config: StravaServerConfig,
): Promise<string> {
  const now = new Date();
  const expiry = typeof credentials.token_expires_at === "number" ? credentials.token_expires_at : Number(credentials.token_expires_at);

  if (tokenIsFresh(expiry, now)) {
    return decryptStravaSecret(credentials.access_token_ciphertext, config.tokenSecret);
  }

  const refreshToken = decryptStravaSecret(credentials.refresh_token_ciphertext, config.tokenSecret);
  const fresh = await refreshStravaToken(config.clientId, config.clientSecret, refreshToken);
  const newAccess = encryptStravaSecret(fresh.accessToken, config.tokenSecret);
  const newRefresh = encryptStravaSecret(fresh.refreshToken, config.tokenSecret);

  await supabase
    .from("strava_credentials")
    .update({
      access_token_ciphertext: newAccess,
      refresh_token_ciphertext: newRefresh,
      token_expires_at: fresh.expiresAt,
      scopes: fresh.scope,
    })
    .eq("user_id", userId);

  return fresh.accessToken;
}

export async function storeStravaAuthorization(
  supabase: SupabaseClient,
  userId: string,
  token: StravaTokenSet,
  athlete: StravaAthlete,
  config: StravaServerConfig,
): Promise<void> {
  const accessCipher = encryptStravaSecret(token.accessToken, config.tokenSecret);
  const refreshCipher = encryptStravaSecret(token.refreshToken, config.tokenSecret);
  const now = new Date().toISOString();
  const athleteName = [athlete.firstname, athlete.lastname].filter(Boolean).join(" ") || null;

  await Promise.all([
    supabase
      .from("strava_credentials")
      .upsert({
        user_id: userId,
        access_token_ciphertext: accessCipher,
        refresh_token_ciphertext: refreshCipher,
        token_expires_at: token.expiresAt,
        scopes: token.scope,
        athlete_id: String(athlete.id),
        athlete_name: athleteName,
      }, { onConflict: "user_id" }),
    supabase
      .from("wearable_connections")
      .upsert({
        user_id: userId,
        provider: "strava",
        status: "connected",
        external_athlete_id: String(athlete.id),
        connected_at: now,
        last_sync_at: now,
      }, { onConflict: "user_id, provider" }),
  ]);
}

export async function disconnectStravaAccount(
  supabase: SupabaseClient,
  userId: string,
): Promise<StravaActionResult> {
  await Promise.all([
    supabase.from("strava_credentials").delete().eq("user_id", userId),
    supabase
      .from("wearable_connections")
      .update({ status: "disconnected" })
      .eq("user_id", userId)
      .eq("provider", "strava"),
  ]);
  return { ok: true, code: "disconnected" };
}

export async function uploadWorkoutToStrava(
  supabase: SupabaseClient,
  userId: string,
  activity: StravaCreateActivity,
  config: StravaServerConfig,
): Promise<StravaActionResult> {
  const credentials = await readCredentials(supabase, userId);
  if (!credentials) return { ok: false, code: "not-connected" };

  let accessToken: string;
  try {
    accessToken = await freshAccessToken(supabase, userId, credentials, config);
  } catch {
    await supabase
      .from("wearable_connections")
      .update({ status: "error" })
      .eq("user_id", userId)
      .eq("provider", "strava");
    return { ok: false, code: "upload-failed" };
  }

  try {
    await createStravaActivity(activity, accessToken);
    return { ok: true, code: "uploaded" };
  } catch (error) {
    if (error instanceof StravaHttpError && error.status === 401) {
      await supabase
        .from("wearable_connections")
        .update({ status: "error" })
        .eq("user_id", userId)
        .eq("provider", "strava");
      return { ok: false, code: "upload-failed" };
    }
    return { ok: false, code: "upload-failed" };
  }
}
