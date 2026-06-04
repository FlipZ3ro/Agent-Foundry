import type { ReviewDecision, WorkerResult } from "../../../packages/schemas/src/index.js";

export class Reviewer {
  review(result: WorkerResult): ReviewDecision {
    const notes = result.producedFiles.length
      ? ["Outputs declared", "Ready for merge queue"]
      : ["No produced files listed"];

    return {
      taskId: result.taskId,
      status: result.producedFiles.length ? "approved" : "changes_requested",
      notes
    };
  }
}
