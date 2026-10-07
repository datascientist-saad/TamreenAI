"use client";

import { useState } from "react";
import { askCoach } from "@/server/actions";
import { ExplainList, SafetyBanner } from "@/components/states";

interface Answer {
  title: string;
  answer: string;
  factors: Array<{ label: string; detail: string }>;
  requiresAcceptance: boolean;
  safety: boolean;
  proposedChanges: unknown[];
}

export function CoachBox() {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      const next = await askCoach(String(formData.get("question") || ""));
      setAnswer(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The coach did not answer.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-4">
      <form action={submit} className="grid gap-3">
        <label>Ask Tamreen
          <textarea name="question" required placeholder="Should I run today?" />
        </label>
        <button className="btn btn-primary" disabled={pending} type="submit">{pending ? "Thinking" : "Ask"}</button>
      </form>
      {error ? <p className="text-sm text-live">{error}</p> : null}
      {answer ? (
        <article className="app-card p-5">
          {answer.safety ? <SafetyBanner /> : null}
          <h2 className="text-2xl font-bold">{answer.title}</h2>
          <p className="mt-2">{answer.answer}</p>
          <ExplainList factors={answer.factors} />
          {answer.proposedChanges.length ? (
            <p className="mt-3 text-sm font-bold">This is a proposal. Accept or keep the original plan from Home. Tamreen will not apply it silently.</p>
          ) : null}
        </article>
      ) : null}
    </div>
  );
}
