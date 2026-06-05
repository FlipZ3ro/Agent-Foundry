import PQueue from "p-queue";

export interface QueueStats {
  concurrency: number;
  size: number;
  pending: number;
  paused: boolean;
}

export class RunQueue {
  private readonly q: PQueue;

  constructor(concurrency = Number(process.env.QUEUE_CONCURRENCY ?? "4")) {
    this.q = new PQueue({ concurrency: Math.max(1, concurrency) });
  }

  /**
   * Enqueue a task. Returns a Promise that resolves when the task completes.
   * onStart is invoked the moment the task begins execution (not when enqueued).
   */
  enqueue<T>(task: () => Promise<T>, onStart?: () => void): {
    queued: { position: number; pending: number };
    started: Promise<void>;
    finished: Promise<T>;
  } {
    let resolveStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      resolveStarted = resolve;
    });
    const position = this.q.size + this.q.pending; // 0 = next, 1 = after one, etc.
    const pending = this.q.pending;
    const finished = this.q.add(async () => {
      onStart?.();
      resolveStarted();
      return await task();
    }) as Promise<T>;
    return {
      queued: { position, pending },
      started,
      finished
    };
  }

  stats(): QueueStats {
    return {
      concurrency: this.q.concurrency,
      size: this.q.size,
      pending: this.q.pending,
      paused: this.q.isPaused
    };
  }
}
