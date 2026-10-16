import assert from "node:assert/strict";
import test from "node:test";
import { mergeNarration, narratePlan, narrateReview, parseModelJson, reviewFromRules, type SessionBrief } from "./narrate";

const sessions: SessionBrief[] = [
  {
    index: 0,
    date: "2026-10-16",
    sport: "running",
    title: "Easy run",
    objective: "Aerobic support",
    durationMin: 40,
    intensity: "easy",
    why: "Engine why.",
  },
];

test("model text is ignored when it names a session that was not sent", () => {
  const merged = mergeNarration("Engine plan.", sessions, {
    explanation: "One plan, written around the easy run.",
    sessions: [
      { index: 0, why: "Keep this easy so Thursday's quality session stays fresh." },
      { index: 4, why: "This session was not in the calendar payload." },
    ],
  });
  assert.equal(merged.source, "model");
  assert.equal(merged.whyByIndex.size, 1);
  assert.equal(merged.whyByIndex.get(0)?.includes("Thursday"), true);
  assert.equal(merged.explanation.includes("easy run"), true);
});

test("a broken model payload keeps the engine explanation", () => {
  const merged = mergeNarration("Engine plan.", sessions, parseModelJson("not json"));
  assert.equal(merged.source, "rules");
  assert.equal(merged.explanation, "Engine plan.");
});

test("a missing key does not call the model", async () => {
  const previous = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  let called = false;
  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    called = true;
    return new Response("no");
  }) as typeof fetch;
  try {
    const result = await narratePlan({
      engineExplanation: "Engine plan.",
      sports: ["running"],
      goal: "improve_10k",
      eventName: null,
      eventDate: null,
      redFlag: false,
      sessions,
    });
    assert.equal(called, false);
    assert.equal(result.source, "rules");
    assert.equal(result.explanation, "Engine plan.");
  } finally {
    globalThis.fetch = original;
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});

test("severe symptoms stop the review before any model call", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  let called = false;
  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    called = true;
    return new Response("no");
  }) as typeof fetch;
  try {
    const result = await narrateReview({
      title: "Easy run",
      objective: "Aerobic support",
      sport: "running",
      intensity: "easy",
      durationMin: 40,
      why: "Engine why.",
      rpe: 5,
      notes: "Chest pain halfway through.",
      redFlag: false,
      loggedSets: [],
    });
    assert.equal(called, false);
    assert.equal(result.source, "rules");
    assert.match(result.text, /urgent professional care/);
    assert.match(reviewFromRules({
      title: "Easy run",
      objective: "Aerobic support",
      sport: "running",
      intensity: "easy",
      durationMin: 40,
      why: "Engine why.",
      rpe: 5,
      notes: "Felt smooth.",
      redFlag: false,
      loggedSets: [],
    }), /coaching, not a measurement/);
  } finally {
    globalThis.fetch = original;
    delete process.env.OPENAI_API_KEY;
  }
});
