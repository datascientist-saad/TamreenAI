import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptWhoopSecret, encryptWhoopSecret } from "./whoop-crypto";
import { disconnectWhoopAccount, syncWhoopAccount, type WhoopServerConfig } from "./whoop-sync";
import {
  createWhoopState,
  localDay,
  mergeWhoopDays,
  pullWhoopMetrics,
  requestWhoopToken,
  whoopAuthorizeUrl,
  type WhoopCycle,
  type WhoopRecovery,
  type WhoopSleep,
} from "./whoop";

const secret = "test-secret-value-16";
const config: WhoopServerConfig = {
  clientId: "client-id",
  clientSecret: "client-secret",
  tokenSecret: secret,
};
const userId = "11111111-1111-4111-8111-111111111111";

const cycle: WhoopCycle = {
  id: 93845,
  user_id: 10129,
  start: "2022-04-24T02:25:44.774Z",
  end: "2022-04-24T10:25:44.774Z",
  timezone_offset: "-05:00",
  score_state: "SCORED",
  score: { strain: 5.2951527, kilojoule: 8288.297, average_heart_rate: 68, max_heart_rate: 141 },
};

const recovery: WhoopRecovery = {
  cycle_id: 93845,
  sleep_id: "123e4567-e89b-12d3-a456-426614174000",
  score_state: "SCORED",
  score: {
    user_calibrating: false,
    recovery_score: 44,
    resting_heart_rate: 64,
    hrv_rmssd_milli: 31.813562,
    spo2_percentage: 95.6875,
    skin_temp_celsius: 33.7,
  },
};

const night: WhoopSleep = {
  id: "ecfc6a15-4661-442f-a9a4-f160dd7afae8",
  cycle_id: 93845,
  start: "2022-04-24T02:25:44.774Z",
  end: "2022-04-24T10:25:44.774Z",
  nap: false,
  score_state: "SCORED",
  score: {
    stage_summary: {
      total_in_bed_time_milli: 30272735,
      total_light_sleep_time_milli: 14905851,
      total_slow_wave_sleep_time_milli: 6630370,
      total_rem_sleep_time_milli: 5879573,
    },
    respiratory_rate: 16.11328125,
    sleep_performance_percentage: 98,
    sleep_consistency_percentage: 90,
    sleep_efficiency_percentage: 91.69533848,
  },
};

test("WHOOP state is 8 characters and the authorize URL keeps the client secret on the server", () => {
  const state = createWhoopState(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]));
  assert.equal(state, "ABCDEFGH");
  assert.equal(createWhoopState().length, 8);
  const url = new URL(whoopAuthorizeUrl({
    clientId: "client-id",
    redirectUri: "https://tamreen.ai/api/whoop/callback",
    state,
  }));
  assert.equal(url.searchParams.get("state"), "ABCDEFGH");
  assert.equal(url.searchParams.get("client_id"), "client-id");
  assert.equal(url.searchParams.get("scope")?.includes("offline"), true);
  assert.equal(url.searchParams.get("scope")?.includes("read:recovery"), true);
  assert.equal(url.searchParams.has("client_secret"), false);
  assert.throws(() => whoopAuthorizeUrl({ clientId: "client-id", redirectUri: "https://tamreen.ai/cb", state: "short" }));
});

test("merge keeps scored WHOOP values and leaves unscored or out-of-range values empty", () => {
  const [day] = mergeWhoopDays({
    cycles: [cycle],
    recoveries: [recovery],
    sleeps: [night, {
      ...night,
      id: "nap",
      nap: true,
      score: { sleep_performance_percentage: 10, stage_summary: { total_light_sleep_time_milli: 1_000 } },
    }],
  });
  assert.equal(localDay(cycle.start, "-05:00"), "2022-04-23");
  assert.equal(day?.day, "2022-04-23");
  assert.equal(day?.recoveryScore, 44);
  assert.equal(day?.strain, 5.2951527);
  assert.equal(day?.hrvRmssdMilli, 31.813562);
  assert.equal(day?.sleepPerformancePercentage, 98);
  assert.equal(day?.asleepMilli, 14905851 + 6630370 + 5879573);
  assert.equal(day?.sleepIsNap, false);

  const [pending] = mergeWhoopDays({
    cycles: [{ ...cycle, id: 2, score_state: "PENDING_SCORE", score: { strain: 12 } }],
    recoveries: [{ ...recovery, cycle_id: 2, score_state: "PENDING_SCORE" }],
    sleeps: [],
  });
  assert.equal(pending?.strain, null);
  assert.equal(pending?.recoveryScore, null);

  const [wild] = mergeWhoopDays({
    cycles: [{ ...cycle, id: 3, score: { strain: 22, kilojoule: 1, average_heart_rate: 60, max_heart_rate: 120 } }],
    recoveries: [],
    sleeps: [],
  });
  assert.equal(wild?.strain, null);
});

test("token exchange posts form fields and rejects an empty token body", async () => {
  let contentType = "";
  let raw = "";
  const token = await requestWhoopToken({
    grant_type: "authorization_code",
    code: "abc",
    client_id: "client-id",
    client_secret: "client-secret",
    redirect_uri: "https://tamreen.ai/api/whoop/callback",
  }, async (_input, init) => {
    contentType = String(new Headers(init?.headers).get("content-type"));
    raw = String(init?.body);
    return new Response(JSON.stringify({
      access_token: "access",
      refresh_token: "refresh",
      expires_in: 3600,
      scope: "offline",
    }), { status: 200 });
  });
  assert.equal(contentType, "application/x-www-form-urlencoded");
  assert.equal(raw.includes("client_secret=client-secret"), true);
  assert.equal(token.refreshToken, "refresh");
  await assert.rejects(() => requestWhoopToken({ grant_type: "authorization_code" }, async () => new Response("{}", { status: 200 })));
});

test("encrypted WHOOP tokens round-trip and fail closed when the secret changes", () => {
  const payload = encryptWhoopSecret("refresh-token", secret);
  assert.equal(decryptWhoopSecret(payload, secret), "refresh-token");
  assert.notEqual(payload, "refresh-token");
  assert.throws(() => decryptWhoopSecret(payload, "another-secret-value"));
});

function memoryClient(tables: Record<string, Record<string, unknown>[]>) {
  return {
    from(table: string) {
      const query: { op: string; filters: Array<[string, string]>; payload?: unknown } = { op: "select", filters: [] };
      const rows = () => tables[table] ?? [];
      const matches = (row: Record<string, unknown>) => query.filters.every(([column, value]) => String(row[column]) === value);
      const execute = (single: boolean) => {
        const current = rows();
        if (query.op === "select") {
          const found = current.filter(matches);
          return { data: single ? found[0] ?? null : found, error: null };
        }
        if (query.op === "upsert") {
          const incoming = Array.isArray(query.payload) ? query.payload as Record<string, unknown>[] : [query.payload as Record<string, unknown>];
          for (const row of incoming) {
            const index = current.findIndex((item) => item.user_id === row.user_id && (table === "whoop_metrics" ? item.cycle_id === row.cycle_id : table !== "wearable_connections" || item.provider === row.provider));
            if (index >= 0) current[index] = { ...current[index], ...row };
            else current.push({ ...row });
          }
          tables[table] = current;
          return { data: null, error: null };
        }
        if (query.op === "update") {
          for (const row of current) {
            if (matches(row)) Object.assign(row, query.payload);
          }
          return { data: null, error: null };
        }
        if (query.op === "delete") {
          tables[table] = current.filter((row) => !matches(row));
          return { data: null, error: null };
        }
        return { data: null, error: null };
      };
      const api = {
        select() {
          query.op = "select";
          return api;
        },
        eq(column: string, value: string) {
          query.filters.push([column, value]);
          return api;
        },
        upsert(payload: unknown) {
          query.op = "upsert";
          query.payload = payload;
          return api;
        },
        update(payload: unknown) {
          query.op = "update";
          query.payload = payload;
          return api;
        },
        delete() {
          query.op = "delete";
          return api;
        },
        maybeSingle() {
          return Promise.resolve(execute(true));
        },
        then(resolve: (value: { data: unknown; error: null }) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve(execute(false)).then(resolve, reject);
        },
      };
      return api;
    },
  } as unknown as SupabaseClient;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("sync stores scored WHOOP days and rotates an expired refresh token", async () => {
  const tables: Record<string, Record<string, unknown>[]> = {
    whoop_credentials: [{
      user_id: userId,
      access_token_ciphertext: encryptWhoopSecret("old-access", secret),
      refresh_token_ciphertext: encryptWhoopSecret("old-refresh", secret),
      token_expires_at: "2020-01-01T00:00:00.000Z",
      scopes: "offline",
    }],
    wearable_connections: [],
    whoop_metrics: [],
  };
  let tokenPosts = 0;
  const result = await syncWhoopAccount(memoryClient(tables), userId, config, {
    now: new Date("2026-10-17T12:00:00.000Z"),
    fetchImpl: async (input, init) => {
      const url = String(input);
      if (url.includes("/oauth/oauth2/token")) {
        tokenPosts += 1;
        assert.equal(String(init?.body).includes("refresh_token=old-refresh"), true);
        return json({ access_token: "new-access", refresh_token: "new-refresh", expires_in: 3600, scope: "offline" });
      }
      if (url.endsWith("/v2/user/profile/basic")) return json({ user_id: 10129, email: "athlete@whoop.com", first_name: "A", last_name: "B" });
      if (url.includes("/v2/cycle")) return json({ records: [cycle], next_token: null });
      if (url.includes("/v2/recovery")) return json({ records: [recovery] });
      if (url.includes("/v2/activity/sleep")) return json({ records: [night] });
      throw new Error(`unexpected ${url}`);
    },
  });
  assert.deepEqual(result, { ok: true, code: "synced", count: 1 });
  assert.equal(tokenPosts, 1);
  assert.equal(decryptWhoopSecret(String(tables.whoop_credentials[0]?.refresh_token_ciphertext), secret), "new-refresh");
  assert.equal(tables.whoop_metrics[0]?.recovery_score, 44);
  assert.equal(tables.whoop_metrics[0]?.day, "2022-04-23");
  assert.equal(tables.wearable_connections[0]?.status, "connected");
  assert.equal(tables.wearable_connections[0]?.external_athlete_id, "10129");
});

test("disconnect revokes WHOOP access and clears the stored tokens", async () => {
  const tables: Record<string, Record<string, unknown>[]> = {
    whoop_credentials: [{
      user_id: userId,
      access_token_ciphertext: encryptWhoopSecret("access", secret),
      refresh_token_ciphertext: encryptWhoopSecret("refresh", secret),
      token_expires_at: "2026-10-18T00:00:00.000Z",
      scopes: "offline",
    }],
    wearable_connections: [{
      user_id: userId,
      provider: "whoop",
      status: "connected",
      external_athlete_id: "10129",
      connected_at: "2026-10-01T00:00:00.000Z",
      last_sync_at: "2026-10-17T00:00:00.000Z",
    }],
    whoop_metrics: [{ user_id: userId, cycle_id: 93845, recovery_score: 44 }],
  };
  let revoked = 0;
  const result = await disconnectWhoopAccount(memoryClient(tables), userId, config, async (input, init) => {
    assert.equal(String(input).endsWith("/v2/user/access"), true);
    assert.equal(init?.method, "DELETE");
    revoked += 1;
    return new Response(null, { status: 204 });
  });
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.code, "disconnected");
  assert.equal(revoked, 1);
  assert.equal(tables.whoop_credentials.length, 0);
  assert.equal(tables.wearable_connections[0]?.status, "disconnected");
  assert.equal(tables.wearable_connections[0]?.external_athlete_id, null);
  assert.equal(tables.whoop_metrics.length, 1);
});

test("pullWhoopMetrics follows the next page token", async () => {
  const second: WhoopCycle = { ...cycle, id: 93846, start: "2022-04-25T02:25:44.774Z" };
  const metrics = await pullWhoopMetrics("token", "2022-04-01T00:00:00.000Z", async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/v2/cycle")) {
      if (url.searchParams.get("nextToken")) return json({ records: [second] });
      return json({ records: [cycle], next_token: "next" });
    }
    return json({ records: [] });
  });
  assert.deepEqual(metrics.map((metric) => metric.cycleId), [93845, 93846]);
});
