import express, { type Request, type Response } from "express";
import { pathToFileURL } from "node:url";
import { FileRunStore, MemoryRunStore, RunStore } from "./store.js";

export function createApp(store: RunStore = new MemoryRunStore()) {
  const app = express();
  app.use(express.json());

  app.post("/runs", async (req: Request, res: Response) => {
    const idea = req.body?.idea;
    if (typeof idea !== "string" || !idea.trim()) {
      res.status(400).json({ error: "idea is required" });
      return;
    }

    try {
      const { run } = await store.create(idea);
      res.status(201).json(run);
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      res.status(500).json({ error: message });
    }
  });

  app.get("/runs", (_req: Request, res: Response) => {
    res.json(store.list());
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
    try {
      const retried = await store.retry(String(req.params.id));
      if (!retried) {
        res.status(404).json({ error: "Run not found" });
        return;
      }
      res.status(201).json(retried.run);
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      res.status(500).json({ error: message });
    }
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
