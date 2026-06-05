import express, { type Request, type Response } from "express";
import { pathToFileURL } from "node:url";
import { FileRunStore, MemoryRunStore, RunStore } from "./store.js";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no"
} as const;

export function createApp(store: RunStore = new MemoryRunStore()) {
  const app = express();
  app.use(express.json());

  app.post("/runs", async (req: Request, res: Response) => {
    const idea = req.body?.idea;
    if (typeof idea !== "string" || !idea.trim()) {
      res.status(400).json({ error: "idea is required" });
      return;
    }

    const wait = req.query.wait === "true" || req.query.wait === "1";
    const placeholder = store.begin(idea);

    if (wait) {
      try {
        const finished = await store.waitFor(placeholder.run.id);
        res.status(201).json(finished?.run ?? placeholder.run);
      } catch (err) {
        const message = err instanceof Error ? err.message : "unknown error";
        res.status(500).json({ error: message });
      }
      return;
    }

    res.status(202).json(placeholder.run);
  });

  app.get("/runs", (_req: Request, res: Response) => {
    res.json(store.list());
  });

  app.get("/queue", (_req: Request, res: Response) => {
    res.json(store.queueStats());
  });

  app.get("/runs/:id/artifacts", (req: Request, res: Response) => {
    const id = String(req.params.id);
    if (!store.get(id)) {
      res.status(404).json({ error: "Run not found" });
      return;
    }
    res.json(store.artifacts.list(id));
  });

  app.get("/runs/:id/artifacts/:taskId/*splat", (req: Request, res: Response) => {
    const id = String(req.params.id);
    const taskId = String(req.params.taskId);
    const splat = (req.params as Record<string, string | string[]>).splat;
    const path = Array.isArray(splat) ? splat.join("/") : String(splat ?? "");
    if (!store.get(id)) {
      res.status(404).json({ error: "Run not found" });
      return;
    }
    const content = store.artifacts.readContent(id, taskId, path);
    if (content === undefined) {
      res.status(404).json({ error: "Artifact not found" });
      return;
    }
    res.type("text/plain").send(content);
  });

  app.get("/runs/:id", (req: Request, res: Response) => {
    const entry = store.get(String(req.params.id));
    if (!entry) {
      res.status(404).json({ error: "Run not found" });
      return;
    }

    res.json(entry.run);
  });

  app.post("/runs/:id/retry", async (req: Request, res: Response) => {
    const placeholder = store.beginRetry(String(req.params.id));
    if (!placeholder) {
      res.status(404).json({ error: "Run not found" });
      return;
    }

    const wait = req.query.wait === "true" || req.query.wait === "1";
    if (wait) {
      try {
        const finished = await store.waitFor(placeholder.run.id);
        res.status(201).json(finished?.run ?? placeholder.run);
      } catch (err) {
        const message = err instanceof Error ? err.message : "unknown error";
        res.status(500).json({ error: message });
      }
      return;
    }

    res.status(202).json(placeholder.run);
  });

  app.get("/runs/:id/stream", (req: Request, res: Response) => {
    const id = String(req.params.id);
    const entry = store.get(id);
    if (!entry) {
      res.status(404).json({ error: "Run not found" });
      return;
    }

    res.writeHead(200, SSE_HEADERS);
    res.write(`retry: 2000\n\n`);

    const heartbeat = setInterval(() => {
      res.write(`: ping\n\n`);
    }, 15_000);
    heartbeat.unref?.();

    let unsubscribe: () => void = () => undefined;
    const close = () => {
      clearInterval(heartbeat);
      unsubscribe();
      if (!res.writableEnded) res.end();
    };
    unsubscribe = store.bus.subscribe(id, (event) => {
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      if (event.type === "done" || event.type === "error") {
        close();
      }
    });

    req.on("close", close);
  });

  return app;
}

function main() {
  const port = Number(process.env.PORT || 3210);
  const store = process.env.RUNS_DIR ? new FileRunStore(process.env.RUNS_DIR) : new FileRunStore();
  const app = createApp(store);

  app.listen(port, () => {
    console.log(`Agent Foundry HTTP API listening on http://localhost:${port}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
