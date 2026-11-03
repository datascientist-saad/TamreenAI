"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { optimizeOpenConflicts } from "@/server/actions";

export function OptimizeButton({
  onResult,
}: {
  onResult?: (result: Awaited<ReturnType<typeof optimizeOpenConflicts>>) => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [moves, setMoves] = useState<Array<{ id: string; title: string; fromDate: string; toDate: string; reason: string }>>([]);

  async function run() {
    setPending(true);
    setError("");
    try {
      const result = await optimizeOpenConflicts();
      onResult?.(result);
      setNote(result.explanation);
      setMoves(result.changes);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The schedule was not changed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button className="btn btn-primary min-h-10" type="button" disabled={pending} onClick={() => void run()}>
        {pending ? "Optimizing…" : "Optimize schedule"}
      </button>
      {error ? <p className="text-sm text-live">{error}</p> : null}
      {note ? (
        <div className="rounded-2xl border border-line bg-paper p-3 text-sm" aria-live="polite">
          <p className="font-bold">{note}</p>
          {moves.length ? (
            <ul className="mt-2 grid gap-1">
              {moves.map((move) => (
                <li key={move.id}>{move.title}: {move.fromDate} → {move.toDate}. {move.reason}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
