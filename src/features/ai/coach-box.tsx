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

const prompts = [
  "Should I train as planned today?",
  "Why is my readiness lower?",
  "How should I approach today's workout?",
  "How is my running progressing?",
];

export function CoachBox() {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [question, setQuestion] = useState("");

  async function submit(formData: FormData) {
    setPending(true);
    setError(null);
    setExpanded(false);
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
    <div className="grid gap-3">
      <form action={submit} className="app-card grid gap-3 p-4">
        <label>
          Ask Tamreen
          <textarea
            name="question"
            required
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Should I run today?"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {prompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setQuestion(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
        <button className="btn btn-primary" disabled={pending} aria-busy={pending} type="submit">
          {pending ? "Thinking…" : "Ask"}
        </button>
      </form>
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
      {answer ? (
        <article className="app-card grid gap-2 border-l-2 border-l-maroon p-4">
          {answer.safety ? <SafetyBanner /> : null}
          <h2 className="text-lg font-bold">{answer.title}</h2>
          <p className="text-sm text-muted">{expanded ? answer.answer : answer.answer.slice(0, 220)}{!expanded && answer.answer.length > 220 ? "…" : ""}</p>
          {answer.answer.length > 220 ? (
            <button type="button" className="btn btn-ghost btn-sm w-fit" onClick={() => setExpanded((value) => !value)}>
              {expanded ? "Show less" : "Show more"}
            </button>
          ) : null}
          {expanded ? <ExplainList factors={answer.factors} /> : null}
          {answer.proposedChanges.length ? (
            <p className="text-sm font-semibold text-maroon">
              This is a proposal. Accept or keep the original plan from Home. Tamreen will not apply it silently.
            </p>
          ) : null}
        </article>
      ) : null}
    </div>
  );
}
