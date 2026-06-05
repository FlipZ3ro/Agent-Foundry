import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Orchestrator } from "../services/orchestrator/src/index.js";

describe("orchestrator metrics", () => {
  it("aggregates token and cost metrics on run", async () => {
    const orchestrator = new Orchestrator();
    const { run } = await orchestrator.run("metrics check");

    assert.ok(run.metrics);
    assert.equal(run.metrics!.jobCount, run.results.length);
    assert.ok(run.metrics!.totalTokens > 0);
    assert.ok(run.metrics!.totalCostUsd > 0);
    assert.equal(
      run.metrics!.approvedCount + run.metrics!.changesRequestedCount,
      run.reviews.length
    );
  });

  it("each worker result carries metrics", async () => {
    const orchestrator = new Orchestrator();
    const { run } = await orchestrator.run("metrics per job");

    for (const result of run.results) {
      assert.ok(result.metrics);
      assert.ok(result.metrics!.tokensUsed > 0);
      assert.ok(result.metrics!.durationMs > 0);
    }
  });

  it("replay refreshes metrics", async () => {
    const orchestrator = new Orchestrator();
    const parent = await orchestrator.run("metrics replay");
    const replayed = await orchestrator.replay(parent);

    assert.ok(replayed.run.metrics);
    assert.equal(replayed.run.metrics!.jobCount, replayed.run.results.length);
  });
});
