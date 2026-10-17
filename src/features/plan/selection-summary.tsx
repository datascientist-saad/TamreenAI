import { describePlanSource } from "@/services/ai/plan";

export function SelectionSummary({ inputs }: { inputs: unknown }) {
  const source = describePlanSource(inputs);
  if (!source) return null;
  return (
    <section className="app-card grid gap-3 p-4">
      <div>
        <p className="eyebrow">{source.eyebrow}</p>
        <p className="text-sm">{source.detail}</p>
      </div>
      {source.chips.length ? (
        <ul className="flex flex-wrap gap-2">
          {source.chips.map((chip) => <li key={chip} className="chip">{chip}</li>)}
        </ul>
      ) : null}
    </section>
  );
}
