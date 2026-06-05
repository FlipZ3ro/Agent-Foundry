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
  it("creates a run", async () => {
    const response = await fetch(`${baseUrl}/runs`, {
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

  it("rejects missing ideas", async () => {
    const response = await fetch(`${baseUrl}/runs`, {
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
      await fetch(`${baseUrl}/runs`, {
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

  it("retries a run", async () => {
    const created = await (
      await fetch(`${baseUrl}/runs`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ idea: "Retry flow" })
      })
    ).json();

    const response = await fetch(`${baseUrl}/runs/${created.id}/retry`, { method: "POST" });
    assert.equal(response.status, 201);
    const retried = await response.json();
    assert.ok(retried.id);
    assert.notEqual(retried.id, created.id);
    assert.equal(retried.idea, created.idea);
    assert.equal(retried.retryOf, created.id);
  });
});
