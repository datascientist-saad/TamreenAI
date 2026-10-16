/**
 * Wearable adapters normalize future provider payloads into Tamreen sessions.
 * None of these providers are connected. The app must not invent a sync.
 */

export interface NormalizedActivity {
  provider: string;
  sport: "running" | "cycling" | "swimming" | "strength" | "other";
  startedAt: string;
  durationSeconds: number;
  distanceM: number | null;
  avgHeartRate: number | null;
  load: number | null;
}

export interface WearableProvider {
  id: "garmin" | "apple_health" | "health_connect" | "whoop" | "strava" | "oura";
  displayName: string;
  connected: false;
  connect(): Promise<{ ok: false; reason: string }>;
  normalize(payload: unknown): NormalizedActivity[];
}

function disconnected(id: WearableProvider["id"], displayName: string, reason?: string): WearableProvider {
  return {
    id,
    displayName,
    connected: false,
    async connect() {
      return {
        ok: false,
        reason: reason ?? `${displayName} is not connected. Tamreen will not show imported workouts until a real authorization exists.`,
      };
    },
    normalize() {
      return [];
    },
  };
}

export const wearableProviders: WearableProvider[] = [
  disconnected("garmin", "Garmin"),
  disconnected("apple_health", "Apple Health"),
  disconnected("health_connect", "Health Connect"),
  disconnected("whoop", "WHOOP", "WHOOP waits for a developer client id and secret. Tamreen will not show a connection or imported workouts until those credentials exist."),
  disconnected("strava", "Strava"),
  disconnected("oura", "Oura"),
];

export function providerById(id: string): WearableProvider | undefined {
  return wearableProviders.find((provider) => provider.id === id);
}
