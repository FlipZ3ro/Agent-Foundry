import express, { type Request, type Response } from "express";
import { RunStore, MemoryRunStore } from "./store.js";

export function createApp(store: RunStore = new MemoryRunStore()) {
  const app = express();
  app.use(express.json());

  app.post("/runs", (req: Request, res: Response) => {
    const idea = req.body?.idea;
    if (typeof idea !== "string" || !idea.trim()) {
      res.status(400).json({ error: "idea is required" });
      return;
    }

    const { run } = store.create(idea);
    res.status(201).json(run);
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

  app.post("/runs/:id/retry", (req: Request, res: Response) => {
    const retried = store.retry(String(req.params.id));
    if (!retried) {
      res.status(404).json({ error: "Run not found" });
      return;
    }

    res.status(201).json(retried.run);
  });

  return app;
}

function main() {
  const port = Number(process.env.PORT || 3210);
  const app = createApp();

  app.listen(port, () => {
    console.log(`Agent Foundry HTTP API listening on http://localhost:${port}`);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
