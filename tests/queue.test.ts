import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RunQueue } from "../services/http/src/queue.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("RunQueue", () => {
  it("respects concurrency cap", async () => {
    const queue = new RunQueue(2);
    let active = 0;
    let peak = 0;
    const gates = Array.from({ length: 5 }, () => deferred<void>());
    const finished = Array.from({ length: 5 }, () => deferred<void>());

    gates.forEach((g, i) => {
      queue.enqueue(async () => {
        active++;
        peak = Math.max(peak, active);
        await g.promise;
        active--;
        finished[i]!.resolve();
      });
    });

    // Wait a tick so the 2 active ones have entered.
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(active, 2);

    for (let i = 0; i < 5; i++) {
      gates[i]!.resolve();
      await finished[i]!.promise;
    }

    assert.equal(peak, 2);
  });

  it("reports queue position for newly enqueued tasks", () => {
    const queue = new RunQueue(1);
    const block = deferred<void>();
    const first = queue.enqueue(async () => {
      await block.promise;
    });
    const second = queue.enqueue(async () => undefined);
    const third = queue.enqueue(async () => undefined);

    assert.equal(first.queued.position, 0);
    assert.ok(second.queued.position >= 1);
    assert.ok(third.queued.position >= 1);
    block.resolve();
  });

  it("stats reflect concurrency + size", async () => {
    const queue = new RunQueue(2);
    const stats1 = queue.stats();
    assert.equal(stats1.concurrency, 2);
    assert.equal(stats1.size, 0);
    assert.equal(stats1.pending, 0);

    const block = deferred<void>();
    queue.enqueue(async () => {
      await block.promise;
    });
    queue.enqueue(async () => {
      await block.promise;
    });
    queue.enqueue(async () => {
      await block.promise;
    });

    await new Promise((resolve) => setTimeout(resolve, 5));
    const stats2 = queue.stats();
    assert.equal(stats2.pending, 2);
    assert.equal(stats2.size, 1);
    block.resolve();
  });
});
