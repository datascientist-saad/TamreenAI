"use client";

import { useState } from "react";
import { uploadCompletedWorkoutToStravaAction, uploadLiveSessionToStravaAction } from "@/server/strava-actions";
import { stravaNotice } from "@/services/wearables/strava";

export function StravaUploadButton({
  workoutId,
  sessionId,
  stravaConnected,
}: {
  workoutId?: string;
  sessionId?: string;
  stravaConnected: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  if (!stravaConnected || (!workoutId && !sessionId)) return null;

  async function handleUpload() {
    setStatus("pending");
    setMessage(null);
    try {
      const result = sessionId
        ? await uploadLiveSessionToStravaAction(sessionId)
        : await uploadCompletedWorkoutToStravaAction(workoutId!);
      setStatus(result.ok ? "success" : "error");
      setMessage(stravaNotice(result.code));
    } catch {
      setStatus("error");
      setMessage("Could not upload to Strava. Try again.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {status !== "success" && (
        <button
          className="btn btn-ghost flex items-center gap-2"
          type="button"
          disabled={status === "pending"}
          onClick={handleUpload}
          style={{ borderColor: "#fc4c02", color: "#fc4c02" }}
        >
          <StravaIcon />
          {status === "pending" ? "Uploading…" : "Upload to Strava"}
        </button>
      )}
      {message && (
        <p className={`text-sm font-medium ${status === "success" ? "text-green-600 dark:text-green-400" : "text-live"}`}>
          {message}
        </p>
      )}
    </div>
  );
}

function StravaIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
    </svg>
  );
}
