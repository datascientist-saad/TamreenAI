"use client";

import { useState } from "react";
import { SafetyBanner } from "@/components/states";
import { reviewWorkout } from "@/server/actions";

export function WorkoutReview({
  workoutId,
  logged,
  existing,
}: {
  workoutId: string;
  logged: boolean;
  existing: { text: string; source: "model" | "rules" } | null;
}) {
  const [text, setText] = useState(existing?.text ?? "");
  const [source, setSource] = useState<"model" | "rules" | null>(existing?.source ?? null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const safety = /urgent professional care|stop training/i.test(text);

  return (
    <section className="grid gap-3 border-t border-line pt-4">
      <h2 className="text-lg font-bold">Review</h2>
      {logged ? (
        <button
          className="btn btn-primary min-h-11 w-fit"
          type="button"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            setError("");
            try {
              const result = await reviewWorkout(workoutId);
              setText(result.text);
              setSource(result.source);
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "The review could not be written.");
            } finally {
              setPending(false);
            }
          }}
        >
          {pending ? "Writing the review" : "Review this session"}
        </button>
      ) : (
        <p className="text-sm text-muted">Log this session, then ask for a review.</p>
      )}
      {safety ? <SafetyBanner /> : null}
      {text ? <p>{text}</p> : null}
      {source ? (
        <p className="text-sm text-muted">
          {source === "model"
            ? "Coaching text from the model. It did not change the calendar, and it is not a measurement. The session summary was sent to the model."
            : "Coaching text from Tamreen's rules. The model was not used. This is not a measurement."}
        </p>
      ) : (
        <p className="text-sm text-muted">A review is coaching, not a measurement. When a server key is set, the logged summary is sent to the model.</p>
      )}
      {error ? <p className="text-sm text-live">{error}</p> : null}
    </section>
  );
}
