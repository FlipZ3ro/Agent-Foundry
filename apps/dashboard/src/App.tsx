import { useCallback, useEffect, useRef, useState } from "react";
import { client } from "./api.js";
import { RunList } from "./components/RunList.js";
import { RunDetail } from "./components/RunDetail.js";
import { CreateRunForm } from "./components/CreateRunForm.js";
import { Icon } from "./components/Icon.js";
import type { OrchestrationRun, RunSummary } from "./types.js";

export function App() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selected, setSelected] = useState<OrchestrationRun | null>(null);
  const [activeStream, setActiveStream] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<EventSource | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await client.listRuns();
      setRuns(items.sort((a, b) => b.id.localeCompare(a.id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    return () => {
      streamRef.current?.close();
    };
  }, []);

  const closeStream = useCallback(() => {
    streamRef.current?.close();
    streamRef.current = null;
    setActiveStream(null);
  }, []);

  const subscribe = useCallback(
    (runId: string) => {
      closeStream();
      const source = new EventSource(`/runs/${encodeURIComponent(runId)}/stream`);
      streamRef.current = source;
      setActiveStream(runId);

      source.addEventListener("planned", (ev: MessageEvent<string>) => {
        const data = JSON.parse(ev.data) as { tasks: OrchestrationRun["jobs"]; summary: string };
        setSelected((prev) =>
          prev && prev.id === runId
            ? { ...prev, status: "running" }
            : prev ?? null
        );
        setRuns((prev) => prev.map((r) => (r.id === runId ? { ...r, status: "running" } : r)));
        void refresh();
        void data;
      });

      source.addEventListener("routed", (ev: MessageEvent<string>) => {
        const data = JSON.parse(ev.data) as { decisions: OrchestrationRun["routingDecisions"] };
        setSelected((prev) =>
          prev && prev.id === runId ? { ...prev, routingDecisions: data.decisions } : prev
        );
      });

      source.addEventListener("task-completed", (ev: MessageEvent<string>) => {
        const data = JSON.parse(ev.data) as { result: OrchestrationRun["results"][number] };
        setSelected((prev) => {
          if (!prev || prev.id !== runId) return prev;
          const others = prev.results.filter((r) => r.taskId !== data.result.taskId);
          return { ...prev, results: [...others, data.result] };
        });
      });

      source.addEventListener("task-reviewed", (ev: MessageEvent<string>) => {
        const data = JSON.parse(ev.data) as { review: OrchestrationRun["reviews"][number] };
        setSelected((prev) => {
          if (!prev || prev.id !== runId) return prev;
          const others = prev.reviews.filter((r) => r.taskId !== data.review.taskId);
          return { ...prev, reviews: [...others, data.review] };
        });
      });

      source.addEventListener("history", (ev: MessageEvent<string>) => {
        const data = JSON.parse(ev.data) as { entry: OrchestrationRun["history"][number] };
        setSelected((prev) =>
          prev && prev.id === runId ? { ...prev, history: [...prev.history, data.entry] } : prev
        );
      });

      source.addEventListener("done", (ev: MessageEvent<string>) => {
        const data = JSON.parse(ev.data) as { run: OrchestrationRun };
        setSelected((prev) => (prev && prev.id === runId ? data.run : prev));
        setRuns((prev) => prev.map((r) => (r.id === runId ? { ...r, status: data.run.status } : r)));
        closeStream();
        void refresh();
      });

      source.addEventListener("error", () => {
        // EventSource auto-reconnects on transport errors; close after server signals end-of-stream.
      });
    },
    [closeStream, refresh]
  );

  const select = useCallback(
    async (id: string) => {
      setError(null);
      try {
        const run = await client.getRun(id);
        setSelected(run);
        if (run.status === "running") subscribe(id);
        else closeStream();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [subscribe, closeStream]
  );

  const create = useCallback(
    async (idea: string) => {
      setError(null);
      try {
        const run = await client.createRunAsync(idea);
        await refresh();
        setSelected(run);
        subscribe(run.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [refresh, subscribe]
  );

  const retry = useCallback(
    async (id: string) => {
      setError(null);
      try {
        const run = await client.retryRunAsync(id);
        await refresh();
        setSelected(run);
        subscribe(run.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [refresh, subscribe]
  );

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">AF</div>
          <div className="brand-text">
            <span className="brand-name">Agent Foundry</span>
            <span className="brand-sub">operator</span>
          </div>
        </div>
        <div className="topbar-right">
          {activeStream ? (
            <span className="live-indicator" title={`streaming ${activeStream}`}>
              <span className="live-dot" />
              live
            </span>
          ) : null}
          <span className="kbd">⌘K</span>
          <button className="ghost" onClick={refresh} disabled={loading}>
            <Icon name="refresh" />
            {loading ? "refreshing" : "refresh"}
          </button>
        </div>
      </header>

      {error ? (
        <div className="banner error">
          <Icon name="alert" />
          {error}
        </div>
      ) : null}

      <main className="grid">
        <aside className="sidebar">
          <div>
            <div className="section-head">
              <h2>new run</h2>
            </div>
            <div className="create-card">
              <CreateRunForm onCreate={create} />
            </div>
          </div>

          <div>
            <div className="section-head">
              <h2>runs</h2>
              <span className="count-pill">{runs.length}</span>
            </div>
            <RunList runs={runs} selectedId={selected?.id} onSelect={select} />
          </div>
        </aside>

        <section className="pane detail">
          {selected ? (
            <RunDetail run={selected} onRetry={retry} live={activeStream === selected.id} />
          ) : (
            <div className="empty detail-empty">
              <Icon name="inbox" className="empty-icon" />
              <div className="empty-title">no run selected</div>
              <div className="empty-hint">create a new run or pick one from the sidebar</div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
