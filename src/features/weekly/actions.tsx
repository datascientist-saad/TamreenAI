"use client";

import { useState } from "react";
import { generateWeeklyReview, respondToWeeklyReview } from "@/server/mvp-actions";

export function WeeklyReviewActions({
  latestWeekStart,
  status,
}: {
  latestWeekStart: string | null;
  status: string | null;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className="btn btn-primary"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError("");
          const result = await generateWeeklyReview();
          setPending(false);
          if (!result.ok) setError(result.message);
          else window.location.reload();
        }}
      >
        {pending ? "Building…" : "Generate this week's review"}
      </button>
      {latestWeekStart && status === "pending" ? (
        <>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              await respondToWeeklyReview(latestWeekStart, true);
              setPending(false);
              window.location.reload();
            }}
          >
            Accept proposals
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              await respondToWeeklyReview(latestWeekStart, false);
              setPending(false);
              window.location.reload();
            }}
          >
            Keep original
          </button>
        </>
      ) : null}
      {error ? <p className="w-full text-sm text-live">{error}</p> : null}
    </div>
  );
}
