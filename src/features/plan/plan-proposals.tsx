"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ProposedChangesPanel } from "@/features/plan/proposed-changes";

type Insight = {
  id: string;
  title: string;
  body: string;
  factors?: unknown;
  proposed_changes?: unknown;
};

export function PlanProposedChanges({
  insight,
  returnTo,
}: {
  insight: Insight;
  returnTo: string;
}) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <p className="rounded-[var(--radius-md)] border border-line bg-elevated px-3 py-2 text-sm" role="status">
        Proposal closed. Returning you to the schedule.
      </p>
    );
  }

  const factors = Array.isArray(insight.factors) ? insight.factors as Array<{ label: string; detail: string }> : [];
  const changes = Array.isArray(insight.proposed_changes)
    ? (insight.proposed_changes as Array<Record<string, unknown>>).map((row, index) => ({
      id: String(row.id ?? row.workoutId ?? index),
      title: String(row.title ?? "Workout change"),
      fromDate: String(row.fromDate ?? row.from ?? "—"),
      toDate: String(row.toDate ?? row.to ?? "—"),
      fromDurationMin: typeof row.fromDurationMin === "number" ? row.fromDurationMin : null,
      toDurationMin: typeof row.toDurationMin === "number" ? row.toDurationMin : null,
      fromIntensity: row.fromIntensity == null ? null : String(row.fromIntensity),
      toIntensity: row.toIntensity == null ? null : String(row.toIntensity),
      reason: String(row.reason ?? insight.body),
      impact: row.impact == null ? null : String(row.impact),
      detail: row.detail == null ? null : String(row.detail),
    }))
    : [{
      id: insight.id,
      title: insight.title,
      fromDate: "Current",
      toDate: "Proposed",
      reason: insight.body,
      detail: factors.map((factor) => `${factor.label}: ${factor.detail}`).join(" "),
    }];

  const coachHref = `/ai?kind=change&id=${encodeURIComponent(insight.id)}&context=${encodeURIComponent(insight.title)}&body=${encodeURIComponent(insight.body.slice(0, 280))}&from=${encodeURIComponent(returnTo)}`;

  return (
    <section className="app-card grid gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="eyebrow">Proposed changes</p>
          <h2 className="font-bold">{insight.title}</h2>
        </div>
        <Link className="btn btn-ghost btn-sm" href={coachHref}>Ask about this change</Link>
      </div>
      <ProposedChangesPanel
        proposalId={insight.id}
        explanation={insight.body}
        changes={changes}
        onAcceptAll={async (id) => {
          start(async () => {
            const { respondToRecommendation } = await import("@/server/actions");
            await respondToRecommendation(id, true);
            setDone(true);
            router.push(returnTo);
            router.refresh();
          });
        }}
        onRejectAll={async (id) => {
          start(async () => {
            const { respondToRecommendation } = await import("@/server/actions");
            await respondToRecommendation(id, false);
            setDone(true);
            router.push(returnTo);
            router.refresh();
          });
        }}
      />
      {pending ? <p className="sr-only" role="status">Saving proposal response</p> : null}
    </section>
  );
}
