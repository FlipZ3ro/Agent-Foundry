export type Lane = "planner" | "data" | "backend" | "frontend" | "assets" | "review";
export type JobStatus = "queued" | "in_progress" | "done" | "failed";
export type ReviewStatus = "approved" | "changes_requested";

export interface AcceptanceCriterion {
  id: string;
  description: string;
}

export interface TaskSpec {
  id: string;
  title: string;
  lane: Lane;
  objective: string;
  dependencies: string[];
  acceptanceCriteria: AcceptanceCriterion[];
  outputs: string[];
}

export interface ProjectBlueprint {
  id: string;
  idea: string;
  summary: string;
  lanes: Lane[];
  tasks: TaskSpec[];
}

export interface WorkerJob {
  id: string;
  taskId: string;
  lane: Lane;
  status: JobStatus;
}

export interface WorkerResult {
  jobId: string;
  taskId: string;
  lane: Lane;
  status: Exclude<JobStatus, "queued" | "in_progress">;
  summary: string;
  producedFiles: string[];
}

export interface ReviewDecision {
  taskId: string;
  status: ReviewStatus;
  notes: string[];
}

export function createTaskId(prefix: string, index: number): string {
  return `${prefix}-${String(index).padStart(2, "0")}`;
}
