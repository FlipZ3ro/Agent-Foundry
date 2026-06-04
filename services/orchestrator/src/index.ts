import { createTaskId, type ProjectBlueprint, type TaskSpec, type WorkerJob } from "../../../packages/schemas/src/index.js";
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
        objective: "Document queue + job state contracts",
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
      summary: "Minimal planner → worker → reviewer flow",
      lanes: ["planner", "frontend", "backend", "assets", "review"],
      tasks
    };
  }
}

export class Orchestrator {
  constructor(
    private readonly worker = new WorkerExecutor(),
    private readonly reviewer = new Reviewer()
  ) {}

  run(idea: string) {
    const planner = new Planner();
    const blueprint = planner.createBlueprint(idea);

    const jobs: WorkerJob[] = blueprint.tasks.map((task, index) => ({
      id: `job-${index + 1}`,
      taskId: task.id,
      lane: task.lane,
      status: "queued"
    }));

    const results = jobs.map((job) => {
      const task = blueprint.tasks.find((item) => item.id === job.taskId)!;
      return this.worker.run({ ...job, status: "in_progress" }, task);
    });

    const reviews = results.map((result) => this.reviewer.review(result));

    return { blueprint, jobs, results, reviews };
  }
}
