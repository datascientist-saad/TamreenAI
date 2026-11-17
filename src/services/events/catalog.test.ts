import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { distancesFromPreset, formatDistanceKm, resolveEventTemplate } from "./catalog";
import { detectEventConflicts, pickAnchorEvent, toPlanningEvents } from "./multi-event";

describe("event catalog", () => {
  it("fills triathlon preset distances", () => {
    const distances = distancesFromPreset({ category: "triathlon", preset: "ironman_70_3" });
    assert.equal(distances.swimM, 1900);
    assert.equal(distances.bikeM, 90000);
    assert.equal(distances.runM, 21100);
    assert.equal(distances.templateSlug, "ironman_70_3");
  });

  it("marks custom triathlon when a leg changes", () => {
    const distances = distancesFromPreset({
      category: "triathlon",
      preset: "sprint_triathlon",
      swimM: 800,
      bikeM: 20000,
      runM: 5000,
    });
    assert.equal(distances.templateSlug, null);
    assert.equal(distances.swimM, 800);
  });

  it("resolves half marathon template", () => {
    const template = resolveEventTemplate("running_half");
    assert.ok(template);
    assert.equal(template?.distanceM, 21097.5);
  });

  it("formats kilometres cleanly", () => {
    assert.equal(formatDistanceKm(5000), "5 km");
    assert.equal(formatDistanceKm(21100), "21.1 km");
  });
});

describe("multi-event planning", () => {
  it("anchors on the primary event even if a secondary is sooner", () => {
    const events = toPlanningEvents([
      { id: "a", name: "10K", starts_on: "2027-01-10", priority: "secondary", status: "active", discipline: "running", distance_m: 10000 },
      { id: "b", name: "70.3", starts_on: "2027-03-01", priority: "primary", status: "active", discipline: "triathlon", swim_m: 1900, bike_m: 90000, run_m: 21100 },
    ], "2026-11-17");
    const anchor = pickAnchorEvent(events);
    assert.equal(anchor?.id, "b");
    assert.equal(events.length, 2);
  });

  it("flags tight spacing between scoring events", () => {
    const events = toPlanningEvents([
      { id: "a", name: "A", starts_on: "2027-01-01", priority: "primary", status: "active", discipline: "running" },
      { id: "b", name: "B", starts_on: "2027-01-08", priority: "secondary", status: "active", discipline: "running" },
    ], "2026-11-17");
    const conflicts = detectEventConflicts(events);
    assert.ok(conflicts.some((item) => item.title.includes("spacing")));
  });
});
