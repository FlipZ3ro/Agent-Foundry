import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Orchestrator, topoOrder } from "../services/orchestrator/src/index.js";
import type { TaskSpec } from "../packages/schemas/src/index.js";

function task(id: string, deps: string[] = []): TaskSpec {
  return {
    id,
    title: `t-${id}`,
    lane: "backend",
    objective: "o",
    dependencies: deps,
    acceptanceCriteria: [{ id: `ac-${id}`, description: "x" }],
    outputs: [`${id}.ts`]
  };
}

describe("topoOrder", () => {
  it("orders dependencies before dependents", () => {
    const tasks = [task("task-03", ["task-02"]), task("task-02", ["task-01"]), task("task-01")];
    const ordered = topoOrder(tasks).map((t) => t.id);
    assert.deepEqual(ordered, ["task-01", "task-02", "task-03"]);
  });

  it("keeps original order among independent tasks", () => {
    const tasks = [task("task-01"), task("task-02"), task("task-03")];
    assert.deepEqual(topoOrder(tasks).map((t) => t.id), ["task-01", "task-02", "task-03"]);
  });

  it("handles a diamond graph", () => {
    const tasks = [
      task("task-04", ["task-02", "task-03"]),
      task("task-02", ["task-01"]),
      task("task-03", ["task-01"]),
      task("task-01")
    ];
    const ordered = topoOrder(tasks).map((t) => t.id);
    assert.equal(ordered[0], "task-01");
    assert.equal(ordered[3], "task-04");
    assert.ok(ordered.indexOf("task-02") < ordered.indexOf("task-04"));
    assert.ok(ordered.indexOf("task-03") < ordered.indexOf("task-04"));
  });

  it("does not stall on a cycle (appends remnants)", () => {
    const tasks = [task("task-01", ["task-02"]), task("task-02", ["task-01"])];
    const ordered = topoOrder(tasks).map((t) => t.id);
    assert.equal(ordered.length, 2);
    assert.ok(ordered.includes("task-01"));
    assert.ok(ordered.includes("task-02"));
  });

  it("ignores dependencies that reference missing tasks", () => {
    const tasks = [task("task-02", ["task-99"]), task("task-01")];
    const ordered = topoOrder(tasks).map((t) => t.id);
    assert.equal(ordered.length, 2);
  });
});

describe("Orchestrator dependency-ordered execution (stub mode)", () => {
  it("emits task-completed in dependency order", async () => {
    // Stub planner always emits task-01 (frontend) → task-02 (backend, dep task-01)
    // → task-03 (assets, dep task-02). The hardcoded blueprint already encodes this chain.
    const orchestrator = new Orchestrator(undefined, undefined, undefined);
    const order: string[] = [];
    await orchestrator.run("dependency order check", (ev) => {
      if (ev.type === "task-completed") order.push(ev.taskId);
    });
    // task-01 has no deps, task-02 deps task-01, task-03 deps task-02 → strict order.
    assert.deepEqual(order, ["task-01", "task-02", "task-03"]);
  });
});
