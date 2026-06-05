import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Router } from "../services/orchestrator/src/index.js";
import { findModel } from "../packages/llm/src/index.js";
import type { TaskSpec } from "../packages/schemas/src/index.js";

const router = new Router();

function makeTask(overrides: Partial<TaskSpec>): TaskSpec {
  return {
    id: "task-01",
    title: "t",
    lane: "frontend",
    objective: "o",
    dependencies: [],
    acceptanceCriteria: [{ id: "ac-1", description: "x" }],
    outputs: ["a.ts"],
    ...overrides
  };
}

describe("Router model selection", () => {
  it("execution task routes to fast tier", () => {
    const d = router.decide(makeTask({ lane: "frontend", dependencies: [], outputs: ["a.ts"] }));
    assert.equal(d.mode, "execution");
    assert.equal(d.modelTier, "fast");
    assert.ok(d.modelId);
    assert.equal(findModel(d.modelId!)?.tier, "fast");
  });

  it("backend task routes to standard tier via hybrid", () => {
    const d = router.decide(makeTask({ lane: "backend" }));
    assert.equal(d.mode, "hybrid");
    assert.equal(d.modelTier, "standard");
    assert.ok(d.modelId);
    assert.equal(findModel(d.modelId!)?.tier, "standard");
  });

  it("dependency-heavy task routes to pro tier via reasoning", () => {
    const d = router.decide(
      makeTask({ lane: "assets", dependencies: ["task-01", "task-02"], outputs: ["x.md", "y.md"] })
    );
    assert.equal(d.mode, "reasoning");
    assert.equal(d.modelTier, "pro");
    assert.equal(findModel(d.modelId!)?.tier, "pro");
  });
});
