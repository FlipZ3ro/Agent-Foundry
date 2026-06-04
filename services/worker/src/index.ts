import type { TaskSpec, WorkerJob, WorkerResult } from "../../../packages/schemas/src/index.js";

export class WorkerExecutor {
  run(job: WorkerJob, task: TaskSpec): WorkerResult {
    return {
      jobId: job.id,
      taskId: task.id,
      lane: task.lane,
      status: "done",
      summary: `Completed ${task.title} for lane ${task.lane}`,
      producedFiles: task.outputs
    };
  }
}
