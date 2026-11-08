import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { stravaServerConfig } from "./strava-config";

export interface StravaConnectionView {
  status: "disconnected" | "pending" | "connected" | "error";
  lastSyncAt: string | null;
  connectedAt: string | null;
  athleteId: string | null;
  athleteName: string | null;
}

function isStatus(value: unknown): value is StravaConnectionView["status"] {
  return value === "disconnected" || value === "pending" || value === "connected" || value === "error";
}

export async function loadStravaSnapshot(supabase: SupabaseClient, userId: string) {
  const [connection, credentials] = await Promise.all([
    supabase
      .from("wearable_connections")
      .select("status, last_sync_at, connected_at, external_athlete_id")
      .eq("user_id", userId)
      .eq("provider", "strava")
      .maybeSingle(),
    supabase
      .from("strava_credentials")
      .select("athlete_name")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  const connectionView: StravaConnectionView = {
    status: isStatus(connection.data?.status) ? connection.data.status : "disconnected",
    lastSyncAt: connection.data?.last_sync_at ?? null,
    connectedAt: connection.data?.connected_at ?? null,
    athleteId: connection.data?.external_athlete_id ?? null,
    athleteName: credentials.data?.athlete_name ?? null,
  };
  return {
    configured: stravaServerConfig() !== null,
    connection: connectionView,
  };
}
