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

function disconnected(id: WearableProvider["id"], displayName: string): WearableProvider {
  return {
    id,
    displayName,
    connected: false,
    async connect() {
      return {
        ok: false,
        reason: `${displayName} is not connected. Tamreen will not show imported workouts until a real authorization exists.`,
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
  disconnected("whoop", "WHOOP"),
  disconnected("strava", "Strava"),
  disconnected("oura", "Oura"),
];

export function providerById(id: string): WearableProvider | undefined {
  return wearableProviders.find((provider) => provider.id === id);
}
