"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { acceptOptimizeProposal, proposeOptimization, rejectOptimizeProposal } from "@/server/actions";

type Move = { id: string; title: string; fromDate: string; toDate: string; reason: string };

export function OptimizeButton({
  onResult,
}: {
  onResult?: (result: Awaited<ReturnType<typeof proposeOptimization>>) => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [proposal, setProposal] = useState<{
    id: string;
    explanation: string;
    moves: Move[];
    violations: Array<{ kind: string; detail: string }>;
    feasible: boolean;
  } | null>(null);

  async function propose() {
    setPending(true);
    setError("");
    try {
      const result = await proposeOptimization();
      onResult?.(result);
      if (!result.proposal || !result.changes.length) {
        setProposal(null);
        router.refresh();
        return;
      }
      setProposal({
        id: result.proposal,
        explanation: result.explanation,
        moves: result.changes,
        violations: result.violations ?? [],
        feasible: result.feasible,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The schedule could not be analyzed.");
    } finally {
      setPending(false);
    }
  }

  async function accept() {
    if (!proposal) return;
    setPending(true);
    setError("");
    try {
      await acceptOptimizeProposal(proposal.id);
      setProposal(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The schedule was not changed.");
    } finally {
      setPending(false);
    }
  }

  async function reject() {
    if (!proposal) return;
    setPending(true);
    setError("");
    try {
      await rejectOptimizeProposal(proposal.id);
      setProposal(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The proposal was not cancelled.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-2">
      {!proposal ? (
        <button className="btn btn-primary min-h-10" type="button" disabled={pending} onClick={() => void propose()}>
          {pending ? "Analyzing…" : "Optimize schedule"}
        </button>
      ) : (
        <div className="rounded-2xl border border-line bg-paper p-4 text-sm" aria-live="polite">
          <p className="font-bold">Proposed changes</p>
          <p className="mt-1 text-muted">{proposal.explanation}</p>
          {proposal.violations.length > 0 && (
            <ul className="mt-2 grid gap-1 text-xs text-muted">
              {proposal.violations.map((v, i) => (
                <li key={i} className="rounded-lg bg-gold/10 px-2 py-1">{v.detail}</li>
              ))}
            </ul>
          )}
          <ul className="mt-3 grid gap-1">
            {proposal.moves.map((move) => (
              <li key={move.id} className="rounded-xl bg-maroon/5 px-3 py-2">
                <span className="font-semibold">{move.title}</span>
                <span className="text-muted"> · {move.fromDate} → {move.toDate}</span>
                <span className="block text-xs text-muted">{move.reason}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Nothing has been changed yet. Review the proposal above, then accept or cancel.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn btn-primary" type="button" disabled={pending} onClick={() => void accept()}>
              {pending ? "Applying…" : "Accept"}
            </button>
            <button className="btn btn-ghost" type="button" disabled={pending} onClick={() => void reject()}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {error ? <p className="text-sm text-live">{error}</p> : null}
    </div>
  );
}
