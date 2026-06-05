import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getLaneConfig, listLaneConfigs } from "../services/worker/src/index.js";
import type { Lane } from "../packages/schemas/src/index.js";

const EXPECTED_LANES: Lane[] = ["frontend", "backend", "data", "assets", "review", "planner", "router"];

describe("lane worker registry", () => {
  it("has a config per known lane", () => {
    for (const lane of EXPECTED_LANES) {
      const cfg = getLaneConfig(lane);
      assert.equal(cfg.lane, lane);
      assert.ok(cfg.persona.length > 10);
      assert.ok(cfg.outputDirective.length > 10);
    }
  });

  it("falls back to default for unknown lane", () => {
    const cfg = getLaneConfig("unknown-lane" as Lane);
    assert.equal(cfg.lane, "default");
  });

  it("backend lane has lower temperature than frontend (contracts > creative)", () => {
    const frontend = getLaneConfig("frontend");
    const backend = getLaneConfig("backend");
    assert.ok(backend.temperature < frontend.temperature);
  });

  it("review lane has the strictest temperature", () => {
    const review = getLaneConfig("review");
    const others = listLaneConfigs().filter((c) => c.lane !== "review");
    for (const cfg of others) {
      assert.ok(review.temperature <= cfg.temperature, `${cfg.lane} (${cfg.temperature}) should not be lower than review (${review.temperature})`);
    }
  });

  it("listLaneConfigs returns at least the default + expected lanes", () => {
    const configs = listLaneConfigs();
    const lanes = new Set(configs.map((c) => c.lane));
    assert.ok(lanes.has("default"));
    for (const lane of EXPECTED_LANES) assert.ok(lanes.has(lane), `missing config for ${lane}`);
  });
});
