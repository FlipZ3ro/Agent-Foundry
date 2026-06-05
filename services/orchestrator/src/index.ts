import {
  createRunId,
  createTaskId,
  type ExecutionMode,
  type Lane,
  type OrchestrationRun,
  type ProjectBlueprint,
  type ReviewDecision,
  type RoutingDecision,
  type RunMetrics,
  type TaskSpec,
  type WorkerJob,
  type WorkerResult
} from "../../../packages/schemas/src/index.js";
import { WorkerExecutor } from "../../worker/src/index.js";
import { Reviewer } from "../../reviewer/src/index.js";
import {
  extractJson,
  fromEnv,
  type ChatMessage,
  type LlmClient
} from "../../../packages/llm/src/index.js";

interface PlannerLlmTask {
  title: string;
  lane: Lane;
  objective: string;
  dependencies?: string[];
  acceptanceCriteria?: Array<{ description: string }>;
  outputs?: string[];
}

const PLANNER_SYSTEM = `You are the Planner in a multi-agent product build system.
Decompose the user's idea into a directed task graph of 3 to 6 tasks.
Each task lives in one lane: "frontend", "backend", "data", "assets", or "review".
Dependencies reference earlier task ids in the form "task-01", "task-02", ...
Always respond with a single JSON object of shape:
{
  "summary": "one-sentence plan summary",
  "tasks": [
    {
      "title": "short imperative title",
      "lane": "frontend",
      "objective": "what this task must achieve",
      "dependencies": ["task-01"],
      "acceptanceCriteria": [{"description": "verifiable check"}],
      "outputs": ["path/to/output"]
    }
  ]
}
No prose outside the JSON.`;

export class Planner {
  constructor(private readonly llm: LlmClient | null = fromEnv(), private readonly model = process.env.MIMO_PLANNER_MODEL ?? "mimo-v2.5-pro") {}

  async createBlueprint(idea: string): Promise<ProjectBlueprint> {
    if (this.llm) {
      try {
        return await this.planWithLlm(idea);
      } catch (err) {
        console.error("[planner] LLM planning failed, using stub:", err instanceof Error ? err.message : err);
      }
    }
    return this.stubBlueprint(idea);
  }

  private async planWithLlm(idea: string): Promise<ProjectBlueprint> {
    const messages: ChatMessage[] = [
      { role: "system", content: PLANNER_SYSTEM },
      { role: "user", content: `Idea: ${idea}` }
    ];
    const result = await this.llm!.chat(messages, {
      model: this.model,
      temperature: 0.3,
      maxTokens: 2000,
      jsonMode: true
    });

    const parsed = extractJson<{ summary?: string; tasks: PlannerLlmTask[] }>(result.content);
    const lanesSeen = new Set<Lane>();
    const tasks: TaskSpec[] = parsed.tasks.map((task, index) => {
      const id = createTaskId("task", index + 1);
      lanesSeen.add(task.lane);
      return {
        id,
        title: task.title,
        lane: task.lane,
        objective: task.objective,
        dependencies: (task.dependencies ?? []).filter((dep) => /^task-\d+$/.test(dep)),
        acceptanceCriteria: (task.acceptanceCriteria ?? [{ description: "Output produced" }]).map(
          (ac, j) => ({ id: `ac-${index + 1}-${j + 1}`, description: ac.description })
        ),
        outputs: task.outputs ?? []
      };
    });

    return {
      id: "blueprint-001",
      idea,
      summary: parsed.summary ?? "LLM-planned blueprint",
      lanes: ["planner", "router", ...Array.from(lanesSeen), "review"],
      tasks
    };
  }

  private stubBlueprint(idea: string): ProjectBlueprint {
    const tasks: TaskSpec[] = [
      {
        id: createTaskId("task", 1),
        title: "Define app shell",
        lane: "frontend",
        objective: "Create dashboard shell and navigation",
        dependencies: [],
        acceptanceCriteria: [{ id: "ac-1", description: "Dashboard shell documented" }],
        outputs: ["apps/dashboard/src/page.tsx"]
      },
      {
        id: createTaskId("task", 2),
        title: "Define orchestration contracts",
        lane: "backend",
        objective: "Document queue, routing, and job state contracts",
        dependencies: [createTaskId("task", 1)],
        acceptanceCriteria: [{ id: "ac-2", description: "Task/job schemas shared" }],
        outputs: ["packages/schemas/src/index.ts"]
      },
      {
        id: createTaskId("task", 3),
        title: "Prepare exports lane",
        lane: "assets",
        objective: "Describe export surfaces for PDF, PPT, and Excel",
        dependencies: [createTaskId("task", 2)],
        acceptanceCriteria: [{ id: "ac-3", description: "Export lane placeholders exist" }],
        outputs: ["docs/examples/task-flow.md"]
      }
    ];

    return {
      id: "blueprint-001",
      idea,
      summary: "Minimal planner → router → worker → reviewer flow",
      lanes: ["planner", "router", "frontend", "backend", "assets", "review"],
      tasks
    };
  }
}

export class Router {
  decide(task: TaskSpec): RoutingDecision {
    const dependencyHeavy = task.dependencies.length > 0;
    const outputCount = task.outputs.length;
    let mode: ExecutionMode;
    let owner: RoutingDecision["owner"];
    let reason: string;
    let rubricReady: boolean;

    if (task.lane === "backend") {
      mode = "hybrid";
      owner = "planner+worker-swarm";
      reason = "Backend contracts need planner judgment plus worker execution.";
      rubricReady = true;
    } else if (dependencyHeavy || outputCount > 1) {
      mode = "reasoning";
      owner = "planner";
      reason = "Task has coordination overhead and should stay with the planner.";
      rubricReady = false;
    } else {
      mode = "execution";
      owner = "worker-swarm";
      reason = "Task has a clear output spec and is safe to batch through workers.";
      rubricReady = true;
    }

    return { taskId: task.id, mode, owner, reason, rubricReady };
  }
}

export class Orchestrator {
  constructor(
    private readonly worker = new WorkerExecutor(),
    private readonly reviewer = new Reviewer(),
    private readonly router = new Router(),
    private readonly planner = new Planner()
  ) {}

  async run(idea: string): Promise<{ blueprint: ProjectBlueprint; run: OrchestrationRun }> {
    const blueprint = await this.planner.createBlueprint(idea);
    const routingDecisions = blueprint.tasks.map((task) => this.router.decide(task));

    const jobs: WorkerJob[] = blueprint.tasks.map((task, index) => ({
      id: `job-${index + 1}`,
      taskId: task.id,
      lane: task.lane,
      status: "routed",
      route: routingDecisions.find((decision) => decision.taskId === task.id)!
    }));

    const results: WorkerResult[] = [];
    for (const job of jobs) {
      const task = blueprint.tasks.find((item) => item.id === job.taskId)!;
      results.push(await this.worker.run({ ...job, status: "in_progress" }, task, { idea }));
    }

    const reviews: ReviewDecision[] = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i]!;
      const task = blueprint.tasks.find((item) => item.id === result.taskId)!;
      reviews.push(await this.reviewer.review(result, task));
    }

    const run: OrchestrationRun = {
      id: createRunId(1),
      blueprintId: blueprint.id,
      idea,
      status: reviews.every((review) => review.status === "approved") ? "completed" : "failed",
      routingDecisions,
      jobs,
      results,
      reviews,
      metrics: aggregateMetrics(results, reviews),
      history: [
        {
          at: new Date().toISOString(),
          stage: "planned",
          detail: `Planner created ${blueprint.tasks.length} tasks: ${blueprint.summary}`
        },
        {
          at: new Date().toISOString(),
          stage: "routed",
          detail: `Router classified ${routingDecisions.length} tasks into execution modes.`
        },
        {
          at: new Date().toISOString(),
          stage: "executed",
          detail: `Worker layer completed ${results.length} jobs.`
        },
        {
          at: new Date().toISOString(),
          stage: "reviewed",
          detail: `Reviewer returned ${reviews.length} decisions (${reviews.filter((r) => r.status === "approved").length} approved).`
        }
      ]
    };

    return { blueprint, run };
  }

  async replay(
    parent: { blueprint: ProjectBlueprint; run: OrchestrationRun }
  ): Promise<{ blueprint: ProjectBlueprint; run: OrchestrationRun }> {
    const { blueprint, run: parentRun } = parent;
    const failedTaskIds = new Set(
      parentRun.reviews.filter((review) => review.status !== "approved").map((review) => review.taskId)
    );
    const replayAll = failedTaskIds.size === 0;

    const results: WorkerResult[] = [];
    for (const result of parentRun.results) {
      if (!replayAll && !failedTaskIds.has(result.taskId)) {
        results.push(result);
        continue;
      }
      const task = blueprint.tasks.find((item) => item.id === result.taskId)!;
      const job = parentRun.jobs.find((item) => item.taskId === result.taskId)!;
      results.push(await this.worker.run({ ...job, status: "in_progress" }, task, { idea: parentRun.idea }));
    }

    const reviews: ReviewDecision[] = [];
    for (const result of results) {
      const task = blueprint.tasks.find((item) => item.id === result.taskId)!;
      reviews.push(await this.reviewer.review(result, task));
    }

    const retriedCount = replayAll ? results.length : failedTaskIds.size;
    const now = new Date().toISOString();

    const run: OrchestrationRun = {
      ...parentRun,
      id: parentRun.id,
      status: reviews.every((review) => review.status === "approved") ? "completed" : "failed",
      results,
      reviews,
      metrics: aggregateMetrics(results, reviews),
      history: [
        ...parentRun.history,
        {
          at: now,
          stage: "executed",
          detail: replayAll
            ? `Replay re-ran all ${retriedCount} jobs (no prior failures).`
            : `Replay re-ran ${retriedCount} failed job${retriedCount === 1 ? "" : "s"}.`
        },
        {
          at: now,
          stage: "reviewed",
          detail: `Reviewer returned ${reviews.length} decisions after replay.`
        }
      ]
    };

    return { blueprint, run };
  }
}

function aggregateMetrics(results: WorkerResult[], reviews: ReviewDecision[]): RunMetrics {
  const totalTokens = results.reduce((sum, r) => sum + (r.metrics?.tokensUsed ?? 0), 0);
  const totalCostUsd = Number(
    results.reduce((sum, r) => sum + (r.metrics?.costUsd ?? 0), 0).toFixed(6)
  );
  const approvedCount = reviews.filter((r) => r.status === "approved").length;
  const changesRequestedCount = reviews.length - approvedCount;
  return {
    totalTokens,
    totalCostUsd,
    jobCount: results.length,
    approvedCount,
    changesRequestedCount
  };
}
