import { disconnectWhoopAction, syncWhoopAction } from "@/server/whoop-actions";
import { whoopNotice } from "@/services/wearables/whoop";
import type { WhoopConnectionView } from "@/services/wearables/whoop-load";
import type { WhoopMetricView } from "@/services/wearables/whoop";
import { WhoopMetrics } from "@/features/whoop/metrics";

function syncedLabel(value: string | null) {
  if (!value) return "Not synced yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not synced yet";
  return `Last sync ${date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`;
}

export function WhoopConnect({
  configured,
  connection,
  metrics,
  noticeCode,
}: {
  configured: boolean;
  connection: WhoopConnectionView;
  metrics: WhoopMetricView[];
  noticeCode?: string;
}) {
  const notice = whoopNotice(noticeCode);
  const linked = connection.status === "connected" || connection.status === "error" || connection.status === "pending";
  const showMetrics = linked || metrics.length > 0;
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted">
        Connect WHOOP to bring recovery, strain, and sleep into Tamreen. Nothing is imported until you authorize it.
      </p>
      {notice ? <p className="text-sm">{notice}</p> : null}
      <p className="text-sm text-muted">
        {connection.status === "connected" ? "Connected" : connection.status === "error" ? "Needs attention" : "Not connected"}
        {" · "}
        {syncedLabel(connection.lastSyncAt)}
      </p>
      {showMetrics ? <WhoopMetrics metrics={metrics} compact /> : null}
      <div className="flex flex-wrap gap-2">
        {configured ? (
          <a className="btn btn-primary" href="/api/whoop/connect">{linked ? "Reconnect WHOOP" : "Connect WHOOP"}</a>
        ) : (
          <p className="text-sm text-muted">
            Add WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET, and a WHOOP_TOKEN_SECRET of at least 16 characters. Register /api/whoop/callback as the redirect URL in the WHOOP developer dashboard.
          </p>
        )}
        {linked ? (
          <form action={syncWhoopAction}>
            <button className="btn btn-ghost" type="submit">Sync</button>
          </form>
        ) : null}
        {linked ? (
          <form action={disconnectWhoopAction}>
            <button className="btn btn-ghost" type="submit">Disconnect</button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
