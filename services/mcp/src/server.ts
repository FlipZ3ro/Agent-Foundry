import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { FileRunStore, MemoryRunStore, type RunStore } from "../../http/src/store.js";

export function createMcpServer(store: RunStore = new MemoryRunStore()): McpServer {
  const server = new McpServer({
    name: "agent-foundry",
    version: "0.1.0"
  });

  server.tool(
    "create_run",
    "Decompose an idea into a planner → router → worker → reviewer pipeline and return the completed run with metrics, routing decisions, and per-task reviews.",
    { idea: z.string().min(1).describe("Plain-English description of what to build or research.") },
    async ({ idea }) => {
      const { run } = await store.create(idea);
      return {
        content: [{ type: "text", text: JSON.stringify(run, null, 2) }]
      };
    }
  );

  server.tool(
    "list_runs",
    "List all recorded runs as compact summaries (id, idea, status, timestamps, retryOf).",
    {},
    async () => ({
      content: [{ type: "text", text: JSON.stringify(store.list(), null, 2) }]
    })
  );

  server.tool(
    "get_run",
    "Fetch a single run by id including blueprint, routing decisions, worker results, reviewer decisions, and history.",
    { id: z.string().describe("Run id, e.g. run-001") },
    async ({ id }) => {
      const entry = store.get(id);
      if (!entry) {
        return {
          isError: true,
          content: [{ type: "text", text: `Run not found: ${id}` }]
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(entry.run, null, 2) }]
      };
    }
  );

  server.tool(
    "retry_run",
    "Replay only the tasks whose review status is changes_requested (preserves approved tasks). Returns the new run linked via retryOf.",
    { id: z.string().describe("Parent run id to retry") },
    async ({ id }) => {
      const retried = await store.retry(id);
      if (!retried) {
        return {
          isError: true,
          content: [{ type: "text", text: `Run not found: ${id}` }]
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(retried.run, null, 2) }]
      };
    }
  );

  return server;
}

async function main() {
  const store = process.env.MCP_RUNS_DIR
    ? new FileRunStore(process.env.MCP_RUNS_DIR)
    : new FileRunStore();
  const server = createMcpServer(store);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("agent-foundry mcp server ready (stdio)\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    process.stderr.write(`mcp server failed: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
