import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../services/mcp/src/server.js";
import { MemoryRunStore } from "../services/http/src/store.js";

let client: Client;
let store: MemoryRunStore;

before(async () => {
  store = new MemoryRunStore();
  const server = createMcpServer(store);
  const [a, b] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test-client", version: "0.0.1" }, { capabilities: {} });
  await Promise.all([server.connect(a), client.connect(b)]);
});

after(async () => {
  await client.close();
});

describe("agent-foundry MCP server", () => {
  it("lists the four expected tools", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    assert.deepEqual(names, ["create_run", "get_run", "list_runs", "retry_run"]);
  });

  it("create_run produces a run and stores it", async () => {
    const res = await client.callTool({
      name: "create_run",
      arguments: { idea: "MCP smoke test" }
    });
    assert.equal(res.isError, undefined);
    const text = textOf(res);
    const run = JSON.parse(text);
    assert.ok(run.id);
    assert.equal(run.idea, "MCP smoke test");
    assert.ok(Array.isArray(run.jobs));
  });

  it("list_runs returns previously created runs", async () => {
    const res = await client.callTool({ name: "list_runs", arguments: {} });
    const items = JSON.parse(textOf(res));
    assert.ok(Array.isArray(items));
    assert.ok(items.length >= 1);
  });

  it("get_run returns the full run", async () => {
    const created = JSON.parse(textOf(await client.callTool({
      name: "create_run",
      arguments: { idea: "fetch me" }
    })));

    const fetched = JSON.parse(textOf(await client.callTool({
      name: "get_run",
      arguments: { id: created.id }
    })));

    assert.equal(fetched.id, created.id);
    assert.equal(fetched.idea, "fetch me");
  });

  it("get_run errors cleanly on missing id", async () => {
    const res = await client.callTool({
      name: "get_run",
      arguments: { id: "run-999" }
    });
    assert.equal(res.isError, true);
    assert.match(textOf(res), /not found/i);
  });

  it("retry_run replays a parent run with retryOf set", async () => {
    const parent = JSON.parse(textOf(await client.callTool({
      name: "create_run",
      arguments: { idea: "retry parent" }
    })));

    const retried = JSON.parse(textOf(await client.callTool({
      name: "retry_run",
      arguments: { id: parent.id }
    })));

    assert.notEqual(retried.id, parent.id);
    assert.equal(retried.retryOf, parent.id);
  });
});

function textOf(res: { content?: Array<{ type: string; text?: string }> }): string {
  const block = res.content?.find((c) => c.type === "text");
  if (!block?.text) throw new Error("expected text content in MCP response");
  return block.text;
}
