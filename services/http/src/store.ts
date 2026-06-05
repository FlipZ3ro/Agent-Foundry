import {
  type OrchestrationRun,
  type ProjectBlueprint,
  type ReviewDecision,
  type WorkerJob,
  type WorkerResult,
  createRunId
} from "../../../packages/schemas/src/index.js";
import { Orchestrator } from "../../orchestrator/src/index.js";

export type RunListItem = Pick<OrchestrationRun, "id" | "blueprintId" | "idea" | "status" | "startedAt" | "completedAt">;

export abstract class RunStore {
  abstract create(idea: string): { blueprint: ProjectBlueprint; run: OrchestrationRun };
  abstract get(id: string): { blueprint: ProjectBlueprint; run: OrchestrationRun } | undefined;
  abstract list(): RunListItem[];
  abstract retry(id: string): { blueprint: ProjectBlueprint; run: OrchestrationRun } | undefined;
}

export class MemoryRunStore extends RunStore {
  private readonly orchestrator = new Orchestrator();
  private readonly runs = new Map<string, { blueprint: ProjectBlueprint; run: OrchestrationRun }>();

  create(idea: string) {
    const created = this.orchestrator.run(idea);
    const runId = createRunId(this.runs.size + 1);
    const run: OrchestrationRun = {
      ...created.run,
      id: runId,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString()
    };

    this.runs.set(run.id, { blueprint: created.blueprint, run });
    return { blueprint: created.blueprint, run };
  }

  get(id: string) {
    return this.runs.get(id);
  }

  list(): RunListItem[] {
    return Array.from(this.runs.values()).map(({ run }) => ({
      id: run.id,
      blueprintId: run.blueprintId,
      idea: run.idea,
      status: run.status,
      startedAt: run.startedAt,
      completedAt: run.completedAt
    }));
  }

  retry(id: string) {
    const existing = this.runs.get(id);
    if (!existing) {
      return undefined;
    }

    return this.create(existing.run.idea);
  }
}
