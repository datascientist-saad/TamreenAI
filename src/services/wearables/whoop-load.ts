import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WhoopMetricView } from "./whoop";
import { whoopServerConfig } from "./whoop-config";

export interface WhoopConnectionView {
  status: "disconnected" | "pending" | "connected" | "error";
  lastSyncAt: string | null;
  connectedAt: string | null;
  athleteId: string | null;
}

function isStatus(value: unknown): value is WhoopConnectionView["status"] {
  return value === "disconnected" || value === "pending" || value === "connected" || value === "error";
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function mapMetric(row: Record<string, unknown>): WhoopMetricView {
  return {
    cycleId: Number(row.cycle_id),
    day: String(row.day),
    recoveryScore: num(row.recovery_score),
    restingHeartRate: num(row.resting_heart_rate),
    hrvRmssdMilli: num(row.hrv_rmssd_milli),
    spo2Percentage: num(row.spo2_percentage),
    skinTempCelsius: num(row.skin_temp_celsius),
    userCalibrating: Boolean(row.user_calibrating),
    recoveryState: row.recovery_state == null ? null : String(row.recovery_state),
    strain: num(row.strain),
    kilojoule: num(row.kilojoule),
    averageHeartRate: num(row.average_heart_rate),
    maxHeartRate: num(row.max_heart_rate),
    strainState: row.strain_state == null ? null : String(row.strain_state),
    sleepPerformancePercentage: num(row.sleep_performance_percentage),
    sleepEfficiencyPercentage: num(row.sleep_efficiency_percentage),
    sleepConsistencyPercentage: num(row.sleep_consistency_percentage),
    respiratoryRate: num(row.respiratory_rate),
    asleepMilli: num(row.asleep_milli),
    inBedMilli: num(row.in_bed_milli),
    sleepState: row.sleep_state == null ? null : String(row.sleep_state),
    sleepIsNap: Boolean(row.sleep_is_nap),
  };
}

export async function loadWhoopSnapshot(supabase: SupabaseClient, userId: string, limit = 14) {
  const [connection, metrics] = await Promise.all([
    supabase
      .from("wearable_connections")
      .select("status, last_sync_at, connected_at, external_athlete_id")
      .eq("user_id", userId)
      .eq("provider", "whoop")
      .maybeSingle(),
    supabase
      .from("whoop_metrics")
      .select("cycle_id, day, recovery_score, resting_heart_rate, hrv_rmssd_milli, spo2_percentage, skin_temp_celsius, user_calibrating, recovery_state, strain, kilojoule, average_heart_rate, max_heart_rate, strain_state, sleep_performance_percentage, sleep_efficiency_percentage, sleep_consistency_percentage, respiratory_rate, asleep_milli, in_bed_milli, sleep_state, sleep_is_nap")
      .eq("user_id", userId)
      .order("day", { ascending: false })
      .limit(limit),
  ]);
  const connectionView: WhoopConnectionView = {
    status: isStatus(connection.data?.status) ? connection.data.status : "disconnected",
    lastSyncAt: connection.data?.last_sync_at ?? null,
    connectedAt: connection.data?.connected_at ?? null,
    athleteId: connection.data?.external_athlete_id ?? null,
  };
  return {
    configured: whoopServerConfig() !== null,
    connection: connectionView,
    metrics: ((metrics.data ?? []) as Record<string, unknown>[]).map(mapMetric),
  };
}
