import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPhasePlan, findEventTemplate, readinessEvidence } from "./templates";

describe("event templates", () => {
  it("defines T100 as 2 / 80 / 18", () => {
    const t100 = findEventTemplate("t100");
    assert.ok(t100);
    assert.equal(t100.swimM, 2000);
    assert.equal(t100.bikeM, 80000);
    assert.equal(t100.runM, 18000);
  });

  it("keeps short preparation conservative", () => {
    const t100 = findEventTemplate("t100")!;
    const plan = buildPhasePlan(t100, 8);
    assert.ok(plan.some((phase) => /conservative/i.test(phase.focus)));
  });

  it("marks readiness evidence without inventing percentages", () => {
    const sprint = findEventTemplate("sprint_triathlon")!;
    const rows = readinessEvidence(sprint, { "brick session completed": true });
    assert.ok(rows.some((row) => row.status === "met"));
    assert.ok(rows.some((row) => row.status === "unknown" || row.status === "missing"));
  });
});
