import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPlanHref,
  resolveBackHref,
  sanitizeReturnTo,
  weekStartMonday,
  withReturnTo,
} from "./navigation";

describe("navigation helpers", () => {
  it("sanitizes in-app return paths and rejects external urls", () => {
    assert.equal(sanitizeReturnTo("/plan?week=2026-03-16&day=2026-03-18"), "/plan?week=2026-03-16&day=2026-03-18");
    assert.equal(sanitizeReturnTo("/home"), "/home");
    assert.equal(sanitizeReturnTo("https://evil.example/home"), null);
    assert.equal(sanitizeReturnTo("//evil.example"), null);
    assert.equal(sanitizeReturnTo("/admin"), null);
  });

  it("falls back to safe parents", () => {
    assert.equal(resolveBackHref(null, "event"), "/events");
    assert.equal(resolveBackHref("/home", "event"), "/home");
    assert.equal(resolveBackHref("/plan?week=2026-03-16", "event"), "/plan?week=2026-03-16");
  });

  it("appends from without duplicating query separators", () => {
    assert.equal(withReturnTo("/events/1", "/home"), "/events/1?from=%2Fhome");
    assert.equal(withReturnTo("/events/1?x=1", "/plan?tab=events"), "/events/1?x=1&from=%2Fplan%3Ftab%3Devents");
  });

  it("builds plan hrefs and monday week starts", () => {
    assert.equal(weekStartMonday("2026-03-18"), "2026-03-16"); // Wed → Mon
    assert.equal(weekStartMonday("2026-03-15"), "2026-03-09"); // Sun → prior Mon
    assert.equal(buildPlanHref({ week: "2026-03-16", tab: "events" }), "/plan?week=2026-03-16&tab=events");
  });
});
