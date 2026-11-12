"use client";

import { useState } from "react";
import { activateDraftPlan } from "@/server/mvp-actions";

export function PlanPreviewConfirm() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <div className="grid gap-2">
      <button
        type="button"
        className="btn btn-primary w-fit"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError("");
          const result = await activateDraftPlan();
          setPending(false);
          if (!result.ok) {
            setError(result.message);
            return;
          }
          window.location.assign("/plan");
        }}
      >
        {pending ? "Activating…" : "Confirm and activate plan"}
      </button>
      {error ? <p className="text-sm text-live">{error}</p> : null}
    </div>
  );
}
