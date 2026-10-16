import { safetyMessage } from "@/services/training/engine";

export interface SessionBrief {
  index: number;
  date: string;
  sport: string;
  title: string;
  objective: string;
  durationMin: number;
  intensity: string;
  why: string;
}

export interface NarrationResult {
  explanation: string;
  whyByIndex: Map<number, string>;
  source: "model" | "rules";
}

export interface ReviewInput {
  title: string;
  objective: string;
  sport: string;
  intensity: string;
  durationMin: number;
  why: string;
  rpe: number | null;
  notes: string;
  redFlag: boolean;
  loggedSets: Array<{ name: string; reps: number | null; weightKg: number | null; rpe: number | null }>;
}

export interface ReviewResult {
  text: string;
  source: "model" | "rules";
}

const STOP = /\b(chest pain|fainting|fainted|severe pain|breathless at rest|cannot breathe|can't breathe)\b/i;

const SYSTEM = [
  "You write coaching explanations for Tamreen, a hybrid training app.",
  "Tamreen's rules already placed every session. You must not change dates, sports, titles, durations, intensities, or exercises.",
  "Do not invent measurements, wearable data, heart-rate samples, or accuracy claims.",
  "Do not give a medical diagnosis.",
  "If the athlete reports chest pain, fainting, severe pain, or breathlessness at rest, say only to stop training and seek urgent professional care.",
  "Write plain sentences. Return JSON only.",
].join(" ");

export function parseModelJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

export function mergeNarration(
  engineExplanation: string,
  allowed: SessionBrief[],
  model: unknown,
): NarrationResult {
  const allowedIndexes = new Set(allowed.map((session) => session.index));
  const whyByIndex = new Map<number, string>();
  if (!model || typeof model !== "object") {
    return { explanation: engineExplanation, whyByIndex, source: "rules" };
  }
  const record = model as { explanation?: unknown; sessions?: unknown };
  const explanation = typeof record.explanation === "string" ? record.explanation.trim().slice(0, 1200) : "";
  if (Array.isArray(record.sessions)) {
    for (const row of record.sessions) {
      if (!row || typeof row !== "object") continue;
      const index = Number((row as { index?: unknown }).index);
      const why = (row as { why?: unknown }).why;
      if (!allowedIndexes.has(index) || typeof why !== "string") continue;
      const text = why.trim().slice(0, 500);
      if (text) whyByIndex.set(index, text);
    }
  }
  if (!explanation && whyByIndex.size === 0) {
    return { explanation: engineExplanation, whyByIndex, source: "rules" };
  }
  return {
    explanation: explanation || engineExplanation,
    whyByIndex,
    source: "model",
  };
}

export function reviewFromRules(input: ReviewInput): string {
  if (input.redFlag || STOP.test(input.notes) || STOP.test(input.objective)) return safetyMessage();
  const effort = input.rpe == null ? "" : ` You logged RPE ${input.rpe}.`;
  const purpose = input.objective || input.why || "the session on your calendar";
  return `${input.title} was planned as ${purpose}.${effort} The calendar stays as Tamreen's rules wrote it. This note is coaching, not a measurement.`;
}

async function complete(user: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(12_000),
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
      }),
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = json.choices?.[0]?.message?.content;
    return typeof text === "string" ? text : null;
  } catch {
    return null;
  }
}

export async function narratePlan(input: {
  engineExplanation: string;
  sports: string[];
  goal: string;
  eventName: string | null;
  eventDate: string | null;
  redFlag: boolean;
  sessions: SessionBrief[];
}): Promise<NarrationResult> {
  if (input.redFlag || !process.env.OPENAI_API_KEY) {
    return { explanation: input.engineExplanation, whyByIndex: new Map(), source: "rules" };
  }
  const payload = {
    task: "Rewrite the plan explanation and the why for each listed session. Do not add, remove, or move sessions.",
    sports: input.sports,
    goal: input.goal,
    eventName: input.eventName,
    eventDate: input.eventDate,
    engineExplanation: input.engineExplanation,
    sessions: input.sessions.map((session) => ({
      index: session.index,
      date: session.date,
      sport: session.sport,
      title: session.title,
      durationMin: session.durationMin,
      intensity: session.intensity,
      objective: session.objective,
      engineWhy: session.why,
    })),
    responseShape: { explanation: "string", sessions: [{ index: 0, why: "string" }] },
  };
  const raw = await complete(JSON.stringify(payload));
  if (!raw) return { explanation: input.engineExplanation, whyByIndex: new Map(), source: "rules" };
  return mergeNarration(input.engineExplanation, input.sessions, parseModelJson(raw));
}

export async function narrateReview(input: ReviewInput): Promise<ReviewResult> {
  const fallback = reviewFromRules(input);
  if (input.redFlag || STOP.test(input.notes) || !process.env.OPENAI_API_KEY) {
    return { text: fallback, source: "rules" };
  }
  const raw = await complete(JSON.stringify({
    task: "Write a short post-session coaching review. Do not change the calendar. Do not invent numbers that are not in the log.",
    session: {
      title: input.title,
      sport: input.sport,
      intensity: input.intensity,
      durationMin: input.durationMin,
      objective: input.objective,
      plannedWhy: input.why,
      rpe: input.rpe,
      notes: input.notes,
      sets: input.loggedSets,
    },
    responseShape: { review: "string" },
  }));
  const parsed = raw ? parseModelJson(raw) : null;
  const review = parsed && typeof parsed === "object" ? (parsed as { review?: unknown }).review : null;
  if (typeof review !== "string" || !review.trim()) return { text: fallback, source: "rules" };
  return { text: review.trim().slice(0, 800), source: "model" };
}
