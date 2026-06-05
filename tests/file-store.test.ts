import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileRunStore } from "../services/http/src/store.js";

let dir: string;

before(() => {
  dir = mkdtempSync(join(tmpdir(), "swarmforge-runs-"));
});

after(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("FileRunStore", () => {
  it("persists a run across new store instances", async () => {
    const a = new FileRunStore(dir);
    const created = await a.create("Persist this run");

    const b = new FileRunStore(dir);
    const fetched = b.get(created.run.id);

    assert.ok(fetched);
    assert.equal(fetched!.run.id, created.run.id);
    assert.equal(fetched!.run.idea, "Persist this run");
  });

  it("lists runs from disk in id order", async () => {
    const store = new FileRunStore(dir);
    const first = await store.create("idea A");
    const second = await store.create("idea B");

    const fresh = new FileRunStore(dir);
    const items = fresh.list();
    const ids = items.map((item) => item.id);

    assert.ok(ids.includes(first.run.id));
    assert.ok(ids.includes(second.run.id));
    assert.deepEqual([...ids].sort(), ids);
  });

  it("retry creates a new run linked via retryOf", async () => {
    const store = new FileRunStore(dir);
    const parent = await store.create("retry me");
    const retried = await store.retry(parent.run.id);

    assert.ok(retried);
    assert.notEqual(retried!.run.id, parent.run.id);
    assert.equal(retried!.run.retryOf, parent.run.id);
    assert.equal(retried!.run.idea, parent.run.idea);
    assert.ok(retried!.run.history.length > parent.run.history.length);
  });

  it("returns undefined for unknown ids", async () => {
    const store = new FileRunStore(dir);
    assert.equal(store.get("run-does-not-exist"), undefined);
    assert.equal(await store.retry("run-does-not-exist"), undefined);
  });
});
