import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createApp } from "../services/http/src/app.js";

const JSON_HEADERS = { "Content-Type": "application/json", Accept: "application/json" };

const app = createApp();
const server = app.listen(0);
const address = server.address() as AddressInfo;
const baseUrl = `http://127.0.0.1:${address.port}`;

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

describe("Agent Foundry HTTP API", () => {
  it("creates a run (sync via ?wait=true)", async () => {
    const response = await fetch(`${baseUrl}/runs?wait=true`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ idea: "Build an AI factory MVP" })
    });

    assert.equal(response.status, 201);
    const run = await response.json();
    assert.ok(run.id);
    assert.equal(run.status, "completed");
    assert.ok(Array.isArray(run.jobs));
    assert.ok(run.jobs.length > 0);
    assert.ok(run.startedAt);
    assert.ok(run.completedAt);
  });

  it("creates a run async returns 202 + queued status", async () => {
    const response = await fetch(`${baseUrl}/runs`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ idea: "Async run" })
    });
    assert.equal(response.status, 202);
    const run = await response.json();
    assert.ok(run.id);
    assert.ok(["queued", "running"].includes(run.status), `expected queued|running, got ${run.status}`);
  });

  it("exposes queue stats", async () => {
    const response = await fetch(`${baseUrl}/queue`);
    assert.equal(response.status, 200);
    const stats = await response.json();
    assert.equal(typeof stats.concurrency, "number");
    assert.equal(typeof stats.size, "number");
    assert.equal(typeof stats.pending, "number");
    assert.equal(typeof stats.paused, "boolean");
  });

  it("rejects missing ideas", async () => {
    const response = await fetch(`${baseUrl}/runs?wait=true`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ idea: "" })
    });

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error, "idea is required");
  });

  it("lists runs", async () => {
    const response = await fetch(`${baseUrl}/runs`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.ok(Array.isArray(body));
    assert.ok(body.length >= 1);
    assert.ok(body[0].id);
  });

  it("gets a run by id", async () => {
    const created = await (
      await fetch(`${baseUrl}/runs?wait=true`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ idea: "List run by id" })
      })
    ).json();

    const response = await fetch(`${baseUrl}/runs/${created.id}`);
    assert.equal(response.status, 200);
    const run = await response.json();
    assert.equal(run.id, created.id);
  });

  it("returns 404 for missing run", async () => {
    const response = await fetch(`${baseUrl}/runs/run-999`);
    assert.equal(response.status, 404);
  });

  it("retries a run (sync via ?wait=true)", async () => {
    const created = await (
      await fetch(`${baseUrl}/runs?wait=true`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ idea: "Retry flow" })
      })
    ).json();

    const response = await fetch(`${baseUrl}/runs/${created.id}/retry?wait=true`, { method: "POST" });
    assert.equal(response.status, 201);
    const retried = await response.json();
    assert.ok(retried.id);
    assert.notEqual(retried.id, created.id);
    assert.equal(retried.idea, created.idea);
    assert.equal(retried.retryOf, created.id);
  });

  it("streams events via SSE and terminates on done", async () => {
    const created = await (
      await fetch(`${baseUrl}/runs`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ idea: "Stream me" })
      })
    ).json();

    const response = await fetch(`${baseUrl}/runs/${created.id}/stream`);
    assert.equal(response.status, 200);
    assert.ok(response.headers.get("content-type")?.includes("text/event-stream"));

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const events: string[] = [];
    let buf = "";
    let sawDone = false;
    while (!sawDone) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        const chunk = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        for (const line of chunk.split("\n")) {
          if (line.startsWith("event: ")) events.push(line.slice("event: ".length));
        }
        if (chunk.includes("event: done")) {
          sawDone = true;
          break;
        }
      }
    }
    await reader.cancel().catch(() => undefined);

    assert.ok(events.includes("planned"), `expected 'planned' in ${events.join(",")}`);
    assert.ok(events.includes("done"), `expected 'done' in ${events.join(",")}`);
  });
});
