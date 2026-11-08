"use client";

import { disconnectStravaAction } from "@/server/strava-actions";
import { stravaNotice } from "@/services/wearables/strava";
import type { StravaConnectionView } from "@/services/wearables/strava-load";

function syncedLabel(value: string | null) {
  if (!value) return "Not connected yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not connected yet";
  return `Connected ${date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`;
}

export function StravaConnect({
  configured,
  connection,
  noticeCode,
}: {
  configured: boolean;
  connection: StravaConnectionView;
  noticeCode?: string;
}) {
  const notice = stravaNotice(noticeCode);
  const linked = connection.status === "connected" || connection.status === "error";

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted">
        Connect Strava to upload your Tamreen workouts and view your activity stats in one place.
      </p>
      {notice ? <p className="text-sm font-medium">{notice}</p> : null}
      <div className="flex items-center gap-2 text-sm">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            connection.status === "connected"
              ? "bg-green-500"
              : connection.status === "error"
                ? "bg-yellow-500"
                : "bg-muted"
          }`}
        />
        <span className="text-muted">
          {connection.status === "connected"
            ? `Connected${connection.athleteName ? ` as ${connection.athleteName}` : ""}`
            : connection.status === "error"
              ? "Needs attention"
              : "Not connected"}
          {" · "}
          {syncedLabel(connection.connectedAt)}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {configured ? (
          <a
            className="btn btn-primary"
            href="/api/strava/connect"
            style={{ backgroundColor: "#fc4c02", borderColor: "#fc4c02" }}
          >
            {linked ? "Reconnect Strava" : "Connect Strava"}
          </a>
        ) : (
          <p className="text-sm text-muted">
            Strava integration is not configured on this server. Add STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET to enable it.
          </p>
        )}
        {linked ? (
          <form action={disconnectStravaAction}>
            <button className="btn btn-ghost" type="submit">Disconnect</button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
