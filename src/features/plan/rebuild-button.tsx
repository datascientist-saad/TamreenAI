"use client";

import { useState } from "react";
import { generatePlan } from "@/server/actions";

export function RebuildPlanButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  return (
    <div className="grid gap-1">
      <button
        className="btn btn-gold min-h-10"
        type="button"
        disabled={pending}
        onClick={() => {
          setPending(true);
          setError("");
          void generatePlan()
            .then((result) => {
              if (!result.ok) {
                setError(result.message);
                setPending(false);
                return;
              }
              window.location.assign("/plan");
            })
            .catch(() => {
              setError("The plan could not be rebuilt. Try again.");
              setPending(false);
            });
        }}
      >
        {pending ? "Creating…" : "Create with TamreenAI"}
      </button>
      {error ? <p className="text-sm text-live">{error}</p> : null}
    </div>
  );
}
