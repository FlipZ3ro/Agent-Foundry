import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Reviewer } from "../services/reviewer/src/index.js";
import type { TaskSpec, WorkerResult } from "../packages/schemas/src/index.js";

const reviewer = new Reviewer(null);

const baseTask: TaskSpec = {
  id: "task-01",
  title: "Build endpoint",
  lane: "backend",
  objective: "POST /thing",
  dependencies: [],
  acceptanceCriteria: [
    { id: "ac-1", description: "Endpoint responds 201", weight: 2 },
    { id: "ac-2", description: "Schema validated", weight: 1 }
  ],
  outputs: ["src/route.ts"]
};

function workerResult(producedFiles: string[]): WorkerResult {
  return {
    jobId: "job-1",
    taskId: "task-01",
    lane: "backend",
    status: "done",
    summary: "did the thing",
    producedFiles
  };
}

describe("Reviewer stub rubric scoring", () => {
  it("produces a score per criterion", async () => {
    const review = await reviewer.review(workerResult(["src/route.ts"]), baseTask);
    assert.ok(review.scores);
    assert.equal(review.scores!.length, baseTask.acceptanceCriteria.length);
    assert.deepEqual(
      review.scores!.map((s) => s.criterionId).sort(),
      baseTask.acceptanceCriteria.map((c) => c.id).sort()
    );
  });

  it("approves when files produced (stub heuristic)", async () => {
    const review = await reviewer.review(workerResult(["src/route.ts"]), baseTask);
    assert.equal(review.status, "approved");
    assert.equal(review.overallScore, 5);
  });

  it("requests changes when no files (stub heuristic)", async () => {
    const review = await reviewer.review(workerResult([]), baseTask);
    assert.equal(review.status, "changes_requested");
    assert.equal(review.overallScore, 0);
  });

  it("legacy stub path still works without task", async () => {
    const review = await reviewer.review(workerResult(["x.ts"]));
    assert.equal(review.status, "approved");
    assert.equal(review.overallScore, 5);
  });
});
