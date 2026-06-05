import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createMcpHttpApp } from "../services/mcp/src/http.js";
import { MemoryRunStore } from "../services/http/src/store.js";

let server: Server;
let baseUrl: string;
let client: Client;

before(async () => {
  const store = new MemoryRunStore();
  const app = createMcpHttpApp(store);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/mcp`;

  client = new Client({ name: "http-test-client", version: "0.0.1" }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(new URL(baseUrl));
  await client.connect(transport);
});

after(async () => {
  await client.close();
  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

describe("agent-foundry MCP over HTTP", () => {
  it("lists tools over the network", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    assert.deepEqual(names, ["create_run", "get_run", "list_runs", "retry_run"]);
  });

  it("creates and fetches a run over HTTP", async () => {
    const created = await client.callTool({
      name: "create_run",
      arguments: { idea: "HTTP transport smoke" }
    });
    const run = JSON.parse(textOf(created));
    assert.ok(run.id);
    assert.equal(run.idea, "HTTP transport smoke");

    const fetched = await client.callTool({ name: "get_run", arguments: { id: run.id } });
    assert.equal(JSON.parse(textOf(fetched)).id, run.id);
  });

  it("returns an error for missing run", async () => {
    const res = await client.callTool({ name: "get_run", arguments: { id: "run-404" } });
    assert.equal(res.isError, true);
    assert.match(textOf(res), /not found/i);
  });
});

function textOf(res: { content?: Array<{ type: string; text?: string }> }): string {
  const block = res.content?.find((c) => c.type === "text");
  if (!block?.text) throw new Error("expected text content");
  return block.text;
}
