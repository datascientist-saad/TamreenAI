"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generatePlan } from "@/server/actions";

export function RebuildPlanButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");

  function create(multipleSessionsPerDay: boolean) {
    setPending(true);
    setError("");
    void generatePlan({ multipleSessionsPerDay })
      .then((result) => {
        if (!result.ok) {
          setError(result.message);
          setPending(false);
          return;
        }
        setAsking(false);
        setPending(false);
        router.refresh();
      })
      .catch(() => {
        setError("The plan could not be rebuilt. Try again.");
        setPending(false);
      });
  }

  return (
    <div className="grid gap-1">
      <button
        className="btn btn-gold min-h-10"
        type="button"
        disabled={pending}
        onClick={() => {
          setError("");
          setAsking(true);
        }}
      >
        {pending ? "Creating…" : "Create with TamreenAI"}
      </button>
      {error ? <p className="text-sm text-live">{error}</p> : null}
      {asking ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="doubles-title">
          <div className="app-card grid w-full max-w-md gap-3 p-5">
            <h2 id="doubles-title" className="text-xl font-extrabold">Before TamreenAI writes the plan</h2>
            <p className="text-sm text-muted">Are you comfortable with more than one workout on the same day? Yes keeps every sport you selected by pairing two sessions on some days. No keeps one workout a day and rotates any sport that does not fit.</p>
            <button className="btn btn-primary" type="button" disabled={pending} onClick={() => create(true)}>
              Yes — two workouts on some days
            </button>
            <button className="btn btn-ghost" type="button" disabled={pending} onClick={() => create(false)}>
              No — one workout a day
            </button>
            <button className="btn btn-ghost" type="button" disabled={pending} onClick={() => setAsking(false)}>Cancel</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
