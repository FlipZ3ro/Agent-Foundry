import { EventEmitter } from "node:events";
import type {
  OrchestrationRun,
  ReviewDecision,
  RoutingDecision,
  RunHistoryEntry,
  TaskSpec,
  WorkerResult
} from "../../../packages/schemas/src/index.js";

export type RunEvent =
  | { type: "queued"; position: number; pending: number }
  | { type: "started"; at: string }
  | { type: "planned"; tasks: TaskSpec[]; summary: string }
  | { type: "routed"; decisions: RoutingDecision[] }
  | { type: "task-started"; taskId: string; jobId: string }
  | { type: "task-completed"; taskId: string; result: WorkerResult }
  | { type: "task-reviewed"; taskId: string; review: ReviewDecision }
  | { type: "history"; entry: RunHistoryEntry }
  | { type: "done"; run: OrchestrationRun }
  | { type: "error"; message: string };

const REPLAY_LIMIT = 200;
const IDLE_TTL_MS = 5 * 60 * 1000;

interface BusEntry {
  emitter: EventEmitter;
  buffer: RunEvent[];
  finished: boolean;
  lastTouchedAt: number;
  cleanupTimer?: NodeJS.Timeout;
}

export class RunBus {
  private readonly entries = new Map<string, BusEntry>();

  publish(runId: string, event: RunEvent): void {
    const entry = this.touch(runId);
    if (entry.finished) return;
    entry.buffer.push(event);
    if (entry.buffer.length > REPLAY_LIMIT) entry.buffer.shift();
    entry.emitter.emit("event", event);
    if (event.type === "done" || event.type === "error") {
      entry.finished = true;
      this.scheduleCleanup(runId, entry);
    }
  }

  subscribe(runId: string, listener: (event: RunEvent) => void): () => void {
    const entry = this.touch(runId);
    for (const buffered of entry.buffer) listener(buffered);
    if (entry.finished) return () => undefined;
    entry.emitter.on("event", listener);
    return () => entry.emitter.off("event", listener);
  }

  isFinished(runId: string): boolean {
    return this.entries.get(runId)?.finished ?? false;
  }

  private touch(runId: string): BusEntry {
    let entry = this.entries.get(runId);
    if (!entry) {
      entry = {
        emitter: new EventEmitter(),
        buffer: [],
        finished: false,
        lastTouchedAt: Date.now()
      };
      entry.emitter.setMaxListeners(64);
      this.entries.set(runId, entry);
    } else {
      entry.lastTouchedAt = Date.now();
      if (entry.cleanupTimer) {
        clearTimeout(entry.cleanupTimer);
        entry.cleanupTimer = undefined;
      }
    }
    return entry;
  }

  private scheduleCleanup(runId: string, entry: BusEntry): void {
    entry.cleanupTimer = setTimeout(() => {
      this.entries.delete(runId);
    }, IDLE_TTL_MS);
    entry.cleanupTimer.unref?.();
  }
}
