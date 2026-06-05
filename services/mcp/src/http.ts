import express, { type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createMcpServer } from "./server.js";
import { FileRunStore, MemoryRunStore, type RunStore } from "../../http/src/store.js";

const MCP_PATH = "/mcp";

export function createMcpHttpApp(store: RunStore = new MemoryRunStore()) {
  const app = express();
  app.use(express.json());

  // sessionId -> live transport
  const transports = new Map<string, StreamableHTTPServerTransport>();

  app.post(MCP_PATH, async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    let transport = sessionId ? transports.get(sessionId) : undefined;

    if (!transport) {
      if (sessionId || !isInitializeRequest(req.body)) {
        res.status(400).json({
          jsonrpc: "2.0",
          error: { code: -32000, message: "No valid session. Send an initialize request first." },
          id: null
        });
        return;
      }

      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          transports.set(sid, transport!);
        }
      });

      transport.onclose = () => {
        if (transport!.sessionId) transports.delete(transport!.sessionId);
      };

      const server = createMcpServer(store);
      await server.connect(transport);
    }

    await transport.handleRequest(req, res, req.body);
  });

  // SSE notifications stream (GET) + session termination (DELETE)
  const sessionRequest = async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const transport = sessionId ? transports.get(sessionId) : undefined;
    if (!transport) {
      res.status(400).send("Invalid or missing session id");
      return;
    }
    await transport.handleRequest(req, res);
  };

  app.get(MCP_PATH, sessionRequest);
  app.delete(MCP_PATH, sessionRequest);

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", sessions: transports.size });
  });

  return app;
}

function main() {
  const port = Number(process.env.MCP_HTTP_PORT || 3211);
  const store = process.env.MCP_RUNS_DIR ? new FileRunStore(process.env.MCP_RUNS_DIR) : new FileRunStore();
  const app = createMcpHttpApp(store);
  app.listen(port, () => {
    process.stderr.write(`agent-foundry mcp http server on http://localhost:${port}${MCP_PATH}\n`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
