import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  type OrchestrationRun,
  type ProjectBlueprint,
  createRunId
} from "../../../packages/schemas/src/index.js";
import { Orchestrator } from "../../orchestrator/src/index.js";

export type StoredRun = { blueprint: ProjectBlueprint; run: OrchestrationRun };
export type RunListItem = Pick<
  OrchestrationRun,
  "id" | "blueprintId" | "idea" | "status" | "startedAt" | "completedAt" | "retryOf"
>;

export abstract class RunStore {
  abstract create(idea: string): Promise<StoredRun>;
  abstract get(id: string): StoredRun | undefined;
  abstract list(): RunListItem[];
  abstract retry(id: string): Promise<StoredRun | undefined>;

  protected toListItem(run: OrchestrationRun): RunListItem {
    return {
      id: run.id,
      blueprintId: run.blueprintId,
      idea: run.idea,
      status: run.status,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      retryOf: run.retryOf
    };
  }

  protected async fresh(
    orchestrator: Orchestrator,
    idea: string,
    nextIndex: number,
    retryOf?: string
  ): Promise<StoredRun> {
    const created = await orchestrator.run(idea);
    const now = new Date().toISOString();
    const run: OrchestrationRun = {
      ...created.run,
      id: createRunId(nextIndex),
      startedAt: now,
      completedAt: now,
      retryOf
    };
    return { blueprint: created.blueprint, run };
  }

  protected async replayed(
    orchestrator: Orchestrator,
    parent: StoredRun,
    nextIndex: number
  ): Promise<StoredRun> {
    const replay = await orchestrator.replay(parent);
    const now = new Date().toISOString();
    const run: OrchestrationRun = {
      ...replay.run,
      id: createRunId(nextIndex),
      startedAt: now,
      completedAt: now,
      retryOf: parent.run.id
    };
    return { blueprint: replay.blueprint, run };
  }
}

export class MemoryRunStore extends RunStore {
  private readonly orchestrator = new Orchestrator();
  private readonly runs = new Map<string, StoredRun>();

  async create(idea: string): Promise<StoredRun> {
    const stored = await this.fresh(this.orchestrator, idea, this.runs.size + 1);
    this.runs.set(stored.run.id, stored);
    return stored;
  }

  get(id: string): StoredRun | undefined {
    return this.runs.get(id);
  }

  list(): RunListItem[] {
    return Array.from(this.runs.values()).map(({ run }) => this.toListItem(run));
  }

  async retry(id: string): Promise<StoredRun | undefined> {
    const existing = this.runs.get(id);
    if (!existing) return undefined;
    const stored = await this.replayed(this.orchestrator, existing, this.runs.size + 1);
    this.runs.set(stored.run.id, stored);
    return stored;
  }
}

export class FileRunStore extends RunStore {
  private readonly orchestrator = new Orchestrator();
  private readonly dir: string;

  constructor(dir = resolve(process.cwd(), "runs")) {
    super();
    this.dir = dir;
    if (!existsSync(this.dir)) mkdirSync(this.dir, { recursive: true });
  }

  async create(idea: string): Promise<StoredRun> {
    const stored = await this.fresh(this.orchestrator, idea, this.nextIndex());
    this.write(stored);
    return stored;
  }

  get(id: string): StoredRun | undefined {
    const path = this.pathFor(id);
    if (!existsSync(path)) return undefined;
    return JSON.parse(readFileSync(path, "utf8")) as StoredRun;
  }

  list(): RunListItem[] {
    return this.allStored()
      .sort((a, b) => a.run.id.localeCompare(b.run.id))
      .map(({ run }) => this.toListItem(run));
  }

  async retry(id: string): Promise<StoredRun | undefined> {
    const existing = this.get(id);
    if (!existing) return undefined;
    const stored = await this.replayed(this.orchestrator, existing, this.nextIndex());
    this.write(stored);
    return stored;
  }

  private pathFor(id: string): string {
    return join(this.dir, `${id}.json`);
  }

  private write(stored: StoredRun): void {
    writeFileSync(this.pathFor(stored.run.id), JSON.stringify(stored, null, 2));
  }

  private allStored(): StoredRun[] {
    return readdirSync(this.dir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => JSON.parse(readFileSync(join(this.dir, name), "utf8")) as StoredRun);
  }

  private nextIndex(): number {
    return this.allStored().length + 1;
  }
}
