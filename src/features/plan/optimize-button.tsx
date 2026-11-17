"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { acceptOptimizeProposal, proposeOptimization, rejectOptimizeProposal } from "@/server/actions";
import { ProposedChangesPanel, type ProposedChange } from "./proposed-changes";

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
    moves: ProposedChange[];
    violations: Array<{ kind: string; detail: string }>;
    feasible: boolean;
  } | null>(null);

  async function propose() {
    if (pending) return;
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
        moves: result.changes.map((move) => ({
          id: move.id,
          title: move.title,
          fromDate: move.fromDate,
          toDate: move.toDate,
          reason: move.reason,
          impact: "Reschedules this session within the current week while preserving recovery spacing.",
          eventGoals: [],
          detail: move.reason,
        })),
        violations: result.violations ?? [],
        feasible: result.feasible,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The schedule could not be analyzed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-2">
      {!proposal ? (
        <button className="btn btn-primary min-h-10" type="button" disabled={pending} aria-busy={pending} onClick={() => void propose()}>
          {pending ? "Analyzing…" : "Optimize schedule"}
        </button>
      ) : (
        <ProposedChangesPanel
          proposalId={proposal.id}
          explanation={proposal.explanation}
          changes={proposal.moves}
          violations={proposal.violations}
          onAcceptAll={async (id) => {
            await acceptOptimizeProposal(id);
            setProposal(null);
          }}
          onRejectAll={async (id) => {
            await rejectOptimizeProposal(id);
            setProposal(null);
          }}
        />
      )}
      {error ? <p className="text-sm text-live" role="alert">{error}</p> : null}
    </div>
  );
}
