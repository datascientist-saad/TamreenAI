import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { expandTrainingSports, recommendSportPriorities } from "./priorities";

describe("sport priorities", () => {
  it("expands triathlon into three disciplines without a fourth load", () => {
    const sports = expandTrainingSports(["strength", "running", "swimming", "cycling", "triathlon"]);
    assert.deepEqual(sports.sort(), ["cycling", "running", "strength", "swimming"].sort());
  });

  it("marks triathlon disciplines primary for endurance goals", () => {
    const rows = recommendSportPriorities({
      sports: ["strength", "running", "swimming", "cycling", "triathlon"],
      primaryGoal: "endurance",
    });
    const endurance = rows.filter((row) => ["running", "swimming", "cycling"].includes(row.sport));
    assert.ok(endurance.every((row) => row.priority === "primary"));
  });
});
