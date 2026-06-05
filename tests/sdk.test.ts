import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createApp } from "../services/http/src/app.js";
import { SwarmforgeClient, SwarmforgeError } from "../packages/sdk/src/index.js";

let server: ReturnType<ReturnType<typeof createApp>["listen"]>;
let client: SwarmforgeClient;

before(() => {
  const app = createApp();
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  client = new SwarmforgeClient({ baseUrl: `http://127.0.0.1:${port}` });
});

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve()))
  );
});

describe("SwarmforgeClient", () => {
  it("creates and retrieves a run", async () => {
    const created = await client.createRun("SDK round trip");
    assert.ok(created.id);
    assert.equal(created.idea, "SDK round trip");

    const fetched = await client.getRun(created.id);
    assert.equal(fetched.id, created.id);
  });

  it("lists runs", async () => {
    await client.createRun("List run");
    const items = await client.listRuns();
    assert.ok(items.length >= 1);
    assert.ok(items[0]!.id);
  });

  it("retries a run with retryOf set", async () => {
    const parent = await client.createRun("Parent for retry");
    const retried = await client.retryRun(parent.id);
    assert.equal(retried.retryOf, parent.id);
    assert.notEqual(retried.id, parent.id);
  });

  it("throws SwarmforgeError on 404", async () => {
    await assert.rejects(() => client.getRun("run-not-here"), (err: Error) => {
      assert.ok(err instanceof SwarmforgeError);
      assert.equal((err as SwarmforgeError).status, 404);
      return true;
    });
  });

  it("throws SwarmforgeError on validation", async () => {
    await assert.rejects(() => client.createRun(""), (err: Error) => {
      assert.ok(err instanceof SwarmforgeError);
      assert.equal((err as SwarmforgeError).status, 400);
      return true;
    });
  });
});
