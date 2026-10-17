export function TimeFields({ name, legend }: { name: string; legend: string }) {
  return (
    <fieldset className="grid gap-2 border-0 p-0">
      <legend className="text-sm font-semibold">{legend}</legend>
      <div className="grid grid-cols-3 gap-2">
        <label>
          Hours
          <input name={`${name}Hours`} inputMode="numeric" min={0} max={99} placeholder="0" aria-label={`${legend} hours`} />
        </label>
        <label>
          Minutes
          <input name={`${name}Minutes`} inputMode="numeric" min={0} max={59} placeholder="0" aria-label={`${legend} minutes`} />
        </label>
        <label>
          Seconds
          <input name={`${name}Seconds`} inputMode="numeric" min={0} max={59} placeholder="0" aria-label={`${legend} seconds`} />
        </label>
      </div>
    </fieldset>
  );
}
