"use client";

export function PostWorkoutFeedback() {
  return (
    <fieldset className="grid gap-3 rounded-2xl border border-line bg-paper p-4">
      <legend className="px-1 text-sm font-bold">After the session</legend>
      <label className="flex items-center gap-2 font-medium">
        <input className="h-5 w-5" name="completedAsPlanned" type="checkbox" defaultChecked />
        I completed the planned workout
      </label>
      <label>
        How difficult was it? (1 easy – 10 maximal)
        <input name="difficulty" inputMode="numeric" defaultValue="5" min={1} max={10} />
      </label>
      <label>
        How fatigued do you feel now? (1–5)
        <input name="fatigueAfter" inputMode="numeric" defaultValue="3" min={1} max={5} />
      </label>
      <label className="flex items-center gap-2 font-medium">
        <input className="h-5 w-5" name="painReported" type="checkbox" />
        I felt pain or discomfort
      </label>
      <label>
        Notes
        <textarea name="athleteFeedback" placeholder="Optional — what should Tamreen know for the next plan?" />
      </label>
      <p className="text-xs text-muted">Significant pain reports keep later recommendations conservative. This is not a medical assessment.</p>
    </fieldset>
  );
}

export function feedbackFromForm(formData: FormData) {
  return {
    completedAsPlanned: formData.get("completedAsPlanned") === "on",
    difficulty: formData.get("difficulty") ? Number(formData.get("difficulty")) : null,
    fatigueAfter: formData.get("fatigueAfter") ? Number(formData.get("fatigueAfter")) : null,
    painReported: formData.get("painReported") === "on",
    athleteFeedback: String(formData.get("athleteFeedback") || "").trim(),
  };
}
