export type Lane = "planner" | "router" | "data" | "backend" | "frontend" | "assets" | "review";
export type JobStatus = "queued" | "routed" | "in_progress" | "done" | "failed";
export type ReviewStatus = "approved" | "changes_requested";
export type ExecutionMode = "reasoning" | "execution" | "hybrid";
export type RunStatus = "planned" | "running" | "completed" | "failed";

export interface AcceptanceCriterion {
  id: string;
  description: string;
  weight?: number;
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

export interface RoutingDecision {
  taskId: string;
  mode: ExecutionMode;
  owner: "planner" | "worker-swarm" | "planner+worker-swarm";
  reason: string;
  rubricReady: boolean;
  modelId?: string;
  modelTier?: ModelTier;
}

export type ModelTier = "fast" | "standard" | "pro";

export interface WorkerJob {
  id: string;
  taskId: string;
  lane: Lane;
  status: JobStatus;
  route: RoutingDecision;
}

export interface JobMetrics {
  tokensUsed: number;
  costUsd: number;
  durationMs: number;
}

export interface RunMetrics {
  totalTokens: number;
  totalCostUsd: number;
  jobCount: number;
  approvedCount: number;
  changesRequestedCount: number;
}

export interface WorkerResult {
  jobId: string;
  taskId: string;
  lane: Lane;
  status: Exclude<JobStatus, "queued" | "routed" | "in_progress">;
  summary: string;
  producedFiles: string[];
  metrics?: JobMetrics;
}

export interface CriterionScore {
  criterionId: string;
  score: number;
  rationale: string;
}

export interface ReviewDecision {
  taskId: string;
  status: ReviewStatus;
  notes: string[];
  scores?: CriterionScore[];
  overallScore?: number;
}

export interface RunHistoryEntry {
  at: string;
  stage: "planned" | "routed" | "executed" | "reviewed";
  detail: string;
}

export interface OrchestrationRun {
  id: string;
  blueprintId: string;
  idea: string;
  status: RunStatus;
  routingDecisions: RoutingDecision[];
  jobs: WorkerJob[];
  results: WorkerResult[];
  reviews: ReviewDecision[];
  history: RunHistoryEntry[];
  startedAt?: string;
  completedAt?: string;
  retryOf?: string;
  metrics?: RunMetrics;
}

export function createTaskId(prefix: string, index: number): string {
  return `${prefix}-${String(index).padStart(2, "0")}`;
}

export function createRunId(index = 1): string {
  return `run-${String(index).padStart(3, "0")}`;
}
