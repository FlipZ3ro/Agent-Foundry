import {
  createRunId,
  createTaskId,
  type OrchestrationRun,
  type ProjectBlueprint,
  type RoutingDecision,
  type TaskSpec,
  type WorkerJob
} from "../../../packages/schemas/src/index.js";
import { WorkerExecutor } from "../../worker/src/index.js";
import { Reviewer } from "../../reviewer/src/index.js";

export class Planner {
  createBlueprint(idea: string): ProjectBlueprint {
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

    if (task.lane === "backend") {
      return {
        taskId: task.id,
        mode: "hybrid",
        owner: "planner+worker-swarm",
        reason: "Backend contracts need planner judgment plus worker execution.",
        rubricReady: true
      };
    }

    if (dependencyHeavy || outputCount > 1) {
      return {
        taskId: task.id,
        mode: "reasoning",
        owner: "planner",
        reason: "Task has coordination overhead and should stay with the planner.",
        rubricReady: false
      };
    }

    return {
      taskId: task.id,
      mode: "execution",
      owner: "worker-swarm",
      reason: "Task has a clear output spec and is safe to batch through workers.",
      rubricReady: true
    };
  }
}

export class Orchestrator {
  constructor(
    private readonly worker = new WorkerExecutor(),
    private readonly reviewer = new Reviewer(),
    private readonly router = new Router()
  ) {}

  run(idea: string): { blueprint: ProjectBlueprint; run: OrchestrationRun } {
    const planner = new Planner();
    const blueprint = planner.createBlueprint(idea);

    const routingDecisions = blueprint.tasks.map((task) => this.router.decide(task));

    const jobs: WorkerJob[] = blueprint.tasks.map((task, index) => ({
      id: `job-${index + 1}`,
      taskId: task.id,
      lane: task.lane,
      status: "routed",
      route: routingDecisions.find((decision) => decision.taskId === task.id)!
    }));

    const results = jobs.map((job) => {
      const task = blueprint.tasks.find((item) => item.id === job.taskId)!;
      return this.worker.run({ ...job, status: "in_progress" }, task);
    });

    const reviews = results.map((result) => this.reviewer.review(result));

    const run: OrchestrationRun = {
      id: createRunId(1),
      blueprintId: blueprint.id,
      idea,
      status: reviews.every((review) => review.status === "approved") ? "completed" : "failed",
      routingDecisions,
      jobs,
      results,
      reviews,
      history: [
        {
          at: new Date().toISOString(),
          stage: "planned",
          detail: `Planner created ${blueprint.tasks.length} tasks.`
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
          detail: `Reviewer returned ${reviews.length} decisions.`
        }
      ]
    };

    return { blueprint, run };
  }
}
