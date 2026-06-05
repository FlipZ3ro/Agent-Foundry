import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  type OrchestrationRun,
  type ProjectBlueprint,
  createRunId
} from "../../../packages/schemas/src/index.js";
import { Orchestrator, type ProgressCallback } from "../../orchestrator/src/index.js";
import { RunBus, type RunEvent } from "./run-bus.js";

export type StoredRun = { blueprint: ProjectBlueprint; run: OrchestrationRun };
export type RunListItem = Pick<
  OrchestrationRun,
  "id" | "blueprintId" | "idea" | "status" | "startedAt" | "completedAt" | "retryOf"
>;

export interface CreateOptions {
  retryOf?: string;
}

export abstract class RunStore {
  readonly bus = new RunBus();

  /** Synchronously reserve a run id + placeholder, kick off async pipeline. */
  abstract begin(idea: string, options?: CreateOptions): StoredRun;
  /** Wait for an in-flight run to complete (resolves immediately if already done). */
  abstract waitFor(id: string): Promise<StoredRun | undefined>;
  abstract get(id: string): StoredRun | undefined;
  abstract list(): RunListItem[];
  abstract beginRetry(id: string): StoredRun | undefined;

  /** Backward-compatible blocking create. */
  async create(idea: string): Promise<StoredRun> {
    const placeholder = this.begin(idea);
    return (await this.waitFor(placeholder.run.id)) ?? placeholder;
  }

  /** Backward-compatible blocking retry. */
  async retry(id: string): Promise<StoredRun | undefined> {
    const placeholder = this.beginRetry(id);
    if (!placeholder) return undefined;
    return (await this.waitFor(placeholder.run.id)) ?? placeholder;
  }

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

  protected makePlaceholder(runId: string, idea: string, options?: CreateOptions): StoredRun {
    const now = new Date().toISOString();
    return {
      blueprint: {
        id: "blueprint-001",
        idea,
        summary: "",
        lanes: [],
        tasks: []
      },
      run: {
        id: runId,
        blueprintId: "blueprint-001",
        idea,
        status: "running",
        routingDecisions: [],
        jobs: [],
        results: [],
        reviews: [],
        history: [],
        startedAt: now,
        retryOf: options?.retryOf
      }
    };
  }

  protected wrapProgress(runId: string): ProgressCallback {
    return (event) => this.bus.publish(runId, event as RunEvent);
  }
}

interface MemorySlot {
  current: StoredRun;
  pending?: Promise<StoredRun>;
}

export class MemoryRunStore extends RunStore {
  private readonly orchestrator = new Orchestrator();
  private readonly slots = new Map<string, MemorySlot>();

  begin(idea: string, options?: CreateOptions): StoredRun {
    const runId = createRunId(this.slots.size + 1);
    const placeholder = this.makePlaceholder(runId, idea, options);
    const slot: MemorySlot = { current: placeholder };
    this.slots.set(runId, slot);

    slot.pending = (async () => {
      try {
        const created = await this.orchestrator.run(idea, this.wrapProgress(runId));
        const completedAt = new Date().toISOString();
        const finished: StoredRun = {
          blueprint: created.blueprint,
          run: {
            ...created.run,
            id: runId,
            startedAt: placeholder.run.startedAt,
            completedAt,
            retryOf: options?.retryOf
          }
        };
        slot.current = finished;
        this.bus.publish(runId, { type: "done", run: finished.run });
        return finished;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        slot.current = failPlaceholder(slot.current, message);
        this.bus.publish(runId, { type: "error", message });
        return slot.current;
      }
    })();

    return placeholder;
  }

  async waitFor(id: string): Promise<StoredRun | undefined> {
    const slot = this.slots.get(id);
    if (!slot) return undefined;
    if (slot.pending) await slot.pending;
    return slot.current;
  }

  get(id: string): StoredRun | undefined {
    return this.slots.get(id)?.current;
  }

  list(): RunListItem[] {
    return Array.from(this.slots.values()).map(({ current }) => this.toListItem(current.run));
  }

  beginRetry(id: string): StoredRun | undefined {
    const parentSlot = this.slots.get(id);
    if (!parentSlot) return undefined;
    const parent = parentSlot.current;
    const runId = createRunId(this.slots.size + 1);
    const placeholder = this.makePlaceholder(runId, parent.run.idea, { retryOf: parent.run.id });
    const slot: MemorySlot = { current: placeholder };
    this.slots.set(runId, slot);

    slot.pending = (async () => {
      try {
        const replay = await this.orchestrator.replay(parent, this.wrapProgress(runId));
        const completedAt = new Date().toISOString();
        const finished: StoredRun = {
          blueprint: replay.blueprint,
          run: {
            ...replay.run,
            id: runId,
            startedAt: placeholder.run.startedAt,
            completedAt,
            retryOf: parent.run.id
          }
        };
        slot.current = finished;
        this.bus.publish(runId, { type: "done", run: finished.run });
        return finished;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        slot.current = failPlaceholder(slot.current, message);
        this.bus.publish(runId, { type: "error", message });
        return slot.current;
      }
    })();

    return placeholder;
  }
}

interface FileSlot {
  pending?: Promise<StoredRun>;
}

export class FileRunStore extends RunStore {
  private readonly orchestrator = new Orchestrator();
  private readonly dir: string;
  private readonly slots = new Map<string, FileSlot>();

  constructor(dir = resolve(process.cwd(), "runs")) {
    super();
    this.dir = dir;
    if (!existsSync(this.dir)) mkdirSync(this.dir, { recursive: true });
  }

  begin(idea: string, options?: CreateOptions): StoredRun {
    const runId = createRunId(this.nextIndex());
    const placeholder = this.makePlaceholder(runId, idea, options);
    this.write(placeholder);
    const slot: FileSlot = {};
    this.slots.set(runId, slot);

    slot.pending = (async () => {
      try {
        const created = await this.orchestrator.run(idea, this.wrapProgress(runId));
        const completedAt = new Date().toISOString();
        const finished: StoredRun = {
          blueprint: created.blueprint,
          run: {
            ...created.run,
            id: runId,
            startedAt: placeholder.run.startedAt,
            completedAt,
            retryOf: options?.retryOf
          }
        };
        this.write(finished);
        this.bus.publish(runId, { type: "done", run: finished.run });
        return finished;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const failed = failPlaceholder(placeholder, message);
        this.write(failed);
        this.bus.publish(runId, { type: "error", message });
        return failed;
      }
    })();

    return placeholder;
  }

  async waitFor(id: string): Promise<StoredRun | undefined> {
    const slot = this.slots.get(id);
    if (slot?.pending) {
      return await slot.pending;
    }
    return this.get(id);
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

  beginRetry(id: string): StoredRun | undefined {
    const parent = this.get(id);
    if (!parent) return undefined;
    const runId = createRunId(this.nextIndex());
    const placeholder = this.makePlaceholder(runId, parent.run.idea, { retryOf: parent.run.id });
    this.write(placeholder);
    const slot: FileSlot = {};
    this.slots.set(runId, slot);

    slot.pending = (async () => {
      try {
        const replay = await this.orchestrator.replay(parent, this.wrapProgress(runId));
        const completedAt = new Date().toISOString();
        const finished: StoredRun = {
          blueprint: replay.blueprint,
          run: {
            ...replay.run,
            id: runId,
            startedAt: placeholder.run.startedAt,
            completedAt,
            retryOf: parent.run.id
          }
        };
        this.write(finished);
        this.bus.publish(runId, { type: "done", run: finished.run });
        return finished;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const failed = failPlaceholder(placeholder, message);
        this.write(failed);
        this.bus.publish(runId, { type: "error", message });
        return failed;
      }
    })();

    return placeholder;
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

function failPlaceholder(placeholder: StoredRun, message: string): StoredRun {
  const now = new Date().toISOString();
  return {
    blueprint: placeholder.blueprint,
    run: {
      ...placeholder.run,
      status: "failed",
      completedAt: now,
      history: [
        ...placeholder.run.history,
        { at: now, stage: "reviewed", detail: `Run failed: ${message}` }
      ]
    }
  };
}
