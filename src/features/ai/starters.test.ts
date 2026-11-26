import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCoachStarters, coachReplyAction, frameCoachQuestion } from "@/features/ai/starters";

describe("buildCoachStarters", () => {
  it("prefers plan-change and event prep when both exist", () => {
    const starters = buildCoachStarters({
      hasPlanChange: true,
      eventName: "15K",
      todayWorkoutTitle: "Tempo run",
    });
    assert.equal(starters.length, 2);
    assert.equal(starters[0]?.label, "Why did my plan change?");
    assert.equal(starters[1]?.label, "Help me prepare for my 15K.");
  });

  it("falls back to next workout when no event is set", () => {
    const starters = buildCoachStarters({
      hasPlanChange: false,
      eventName: null,
      todayWorkoutTitle: null,
    });
    assert.equal(starters.length, 2);
    assert.equal(starters[0]?.label, "What’s my next workout?");
  });
});

describe("frameCoachQuestion", () => {
  it("prefixes attached context for the coach request", () => {
    assert.equal(
      frameCoachQuestion("Why move it?", { label: "Easy replacement", detail: "Readiness low" }),
      "[Context: Easy replacement — Readiness low]\n\nWhy move it?",
    );
  });

  it("omits context when the chip was cleared", () => {
    assert.equal(frameCoachQuestion("What’s next?", null), "What’s next?");
  });
});

describe("coachReplyAction", () => {
  it("links race prep for event context", () => {
    const action = coachReplyAction({
      kind: "event",
      eventId: "evt-1",
      weekHref: "/plan",
      from: "/ai",
    });
    assert.equal(action?.label, "Open race prep");
    assert.match(action?.href ?? "", /\/events\/evt-1\/prep/);
  });

  it("links the weekly plan for workout context", () => {
    const action = coachReplyAction({
      kind: "workout",
      weekHref: "/plan?week=2026-11-23",
      from: "/ai",
    });
    assert.equal(action?.label, "View this week’s plan");
    assert.match(action?.href ?? "", /from=%2Fai/);
  });
});
